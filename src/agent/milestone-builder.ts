import type { AgentMilestone } from './milestones';
import type { AgentTraceEvent } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getIncidentPayload = (output: unknown) => {
  if (!isRecord(output)) return null;
  const incident = isRecord(output.incident) ? output.incident : null;
  const payload = isRecord(output.payload) ? output.payload : null;

  if (!incident || typeof incident.incidentId !== 'string') {
    return null;
  }

  return {
    incidentId: incident.incidentId,
    incident,
    payload,
  };
};

const toStakeholderMentions = (payload: unknown) =>
  Array.isArray(payload)
    ? payload.filter((value): value is string => typeof value === 'string')
    : [];

export const buildMilestonesFromTrace = (
  trace: AgentTraceEvent[],
): AgentMilestone[] => {
  const milestones: AgentMilestone[] = [];

  for (const event of trace) {
    if (event.kind !== 'tool_result') {
      continue;
    }

    const result = getIncidentPayload(event.output);

    if (!result) {
      continue;
    }

    const base = {
      id: crypto.randomUUID(),
      incidentId: result.incidentId,
      stepNumber: Math.max(0, event.stepNumber),
      timestamp: event.timestamp,
    };

    switch (event.toolName) {
      case 'detect_repeated_incident': {
        const summary =
          typeof result.payload?.summary === 'string'
            ? result.payload.summary
            : 'Detected repeated incident pattern';

        milestones.push({
          ...base,
          kind: 'incident_detected',
          summary,
          detail: null,
          payload: {
            alertCount:
              typeof result.payload?.alertCount === 'number'
                ? result.payload.alertCount
                : 0,
            repeated:
              typeof result.payload?.repeated === 'boolean'
                ? result.payload.repeated
                : false,
          },
        });
        break;
      }
      case 'start_triage':
        milestones.push({
          ...base,
          kind: 'triage_started',
          summary: `Initiated automated triage for ${result.incidentId}`,
          detail: 'Creating incident timeline and beginning evidence collection.',
          payload: {},
        });
        break;
      case 'read_sentry_signals': {
        const signature =
          typeof result.payload?.signature === 'string'
            ? result.payload.signature
            : null;
        const eventCount =
          typeof result.payload?.eventCount === 'number'
            ? result.payload.eventCount
            : null;

        milestones.push({
          ...base,
          kind: 'sentry_evidence_found',
          summary: signature
            ? `Sentry correlation found ${eventCount ?? 0} events for ${signature}`
            : 'Sentry evidence collected',
          detail:
            typeof result.payload?.suspectedCause === 'string'
              ? result.payload.suspectedCause
              : null,
          payload: {
            signature,
            firstSeenAt:
              typeof result.payload?.firstSeenAt === 'string'
                ? result.payload.firstSeenAt
                : null,
            deployId:
              typeof result.payload?.deployId === 'string'
                ? result.payload.deployId
                : null,
            eventCount,
          },
        });
        break;
      }
      case 'inspect_recent_github_changes': {
        const relevantFiles = Array.isArray(result.payload?.relevantFiles)
          ? result.payload.relevantFiles.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        const suspectPrs = Array.isArray(result.payload?.suspectPrs)
          ? result.payload.suspectPrs.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];

        milestones.push({
          ...base,
          kind: 'github_evidence_found',
          summary: `GitHub evidence linked ${suspectPrs.length} suspect PRs and ${relevantFiles.length} relevant files`,
          detail:
            suspectPrs.length > 0
              ? `Most relevant recent changes: ${suspectPrs.join(', ')}`
              : null,
          payload: {
            relevantFiles,
            suspectPrs,
          },
        });
        break;
      }
      case 'update_incident_report': {
        const note =
          typeof result.payload?.note === 'string' ? result.payload.note : null;

        milestones.push({
          ...base,
          kind: 'report_updated',
          summary: 'Updated live incident report',
          detail: note,
          payload: {
            note,
          },
        });
        break;
      }
      case 'notify_stakeholders': {
        const stakeholders = toStakeholderMentions(result.payload);

        milestones.push({
          ...base,
          kind: 'stakeholders_notified',
          summary: `Notified ${stakeholders.length} stakeholders`,
          detail:
            stakeholders.length > 0 ? stakeholders.join(', ') : 'No stakeholders recorded',
          payload: {
            stakeholders,
          },
        });
        break;
      }
      case 'open_fix_pr': {
        const prNumber =
          typeof result.payload?.fixPr === 'string' ? result.payload.fixPr : null;
        const title =
          typeof result.payload?.title === 'string' ? result.payload.title : null;

        milestones.push({
          ...base,
          kind: 'fix_pr_opened',
          summary: prNumber
            ? `Opened candidate fix PR ${prNumber}`
            : 'Opened candidate fix PR',
          detail: title,
          payload: {
            prNumber,
            title,
            suspectPr:
              typeof result.payload?.suspectPr === 'string'
                ? result.payload.suspectPr
                : null,
          },
        });
        break;
      }
      case 'assign_incident_owner': {
        const owner =
          typeof result.payload?.owner === 'string' ? result.payload.owner : null;

        milestones.push({
          ...base,
          kind: 'owner_assigned',
          summary: owner ? `Incident assigned to ${owner}` : 'Incident owner assigned',
          detail: null,
          payload: { owner },
        });
        break;
      }
      case 'merge_fix':
        milestones.push({
          ...base,
          kind: 'fix_merged',
          summary:
            typeof result.payload?.fixPr === 'string'
              ? `${result.payload.fixPr} merged and rolling out`
              : 'Fix merged and rolling out',
          detail:
            typeof result.payload?.resolutionSummary === 'string'
              ? result.payload.resolutionSummary
              : null,
          payload: {
            prNumber:
              typeof result.payload?.fixPr === 'string' ? result.payload.fixPr : null,
          },
        });
        break;
      case 'start_monitoring':
        milestones.push({
          ...base,
          kind: 'monitoring_started',
          summary: 'Monitoring production for recurring failures',
          detail: null,
          payload: {},
        });
        break;
      case 'check_prod_health': {
        const clean =
          typeof result.payload?.clean === 'boolean' ? result.payload.clean : false;
        const summary =
          typeof result.payload?.summary === 'string'
            ? result.payload.summary
            : clean
              ? 'Monitoring is clean'
              : 'Monitoring detected recurring failures';

        milestones.push({
          ...base,
          kind:
            result.incident.status === 'stabilized'
              ? 'incident_stabilized'
              : 'monitoring_clean',
          summary:
            result.incident.status === 'stabilized'
              ? 'Incident stabilized after clean monitoring window'
              : summary,
          detail: summary,
          payload: {
            clean,
            errorCount:
              typeof result.payload?.errorCount === 'number'
                ? result.payload.errorCount
                : null,
          },
        });
        break;
      }
      default:
        break;
    }
  }

  return milestones;
};
