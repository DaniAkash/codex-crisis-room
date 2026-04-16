import type { AgentMilestone } from './milestones';
import type { AgentTraceEvent } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getToolOutput = (output: unknown) => {
  if (!isRecord(output) || typeof output.incidentId !== 'string') {
    return null;
  }

  return {
    incidentId: output.incidentId,
    output,
  };
};

const toStakeholderMentions = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

export const buildMilestonesFromTrace = (
  trace: AgentTraceEvent[],
): AgentMilestone[] => {
  const milestones: AgentMilestone[] = [];

  for (const event of trace) {
    if (event.kind !== 'tool_result') {
      continue;
    }

    const result = getToolOutput(event.output);

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
          typeof result.output.summary === 'string'
            ? result.output.summary
            : 'Detected repeated incident pattern';

        milestones.push({
          ...base,
          kind: 'incident_detected',
          summary,
          detail: null,
          payload: {
            alertCount:
              typeof result.output.alertCount === 'number'
                ? result.output.alertCount
                : 0,
            repeated:
              typeof result.output.repeated === 'boolean'
                ? result.output.repeated
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
          typeof result.output.signature === 'string'
            ? result.output.signature
            : null;
        const eventCount =
          typeof result.output.eventCount === 'number'
            ? result.output.eventCount
            : null;

        milestones.push({
          ...base,
          kind: 'sentry_evidence_found',
          summary: signature
            ? `Sentry correlation found ${eventCount ?? 0} events for ${signature}`
            : 'Sentry evidence collected',
          detail:
            typeof result.output.suspectedCause === 'string'
              ? result.output.suspectedCause
              : null,
          payload: {
            signature,
            firstSeenAt:
              typeof result.output.firstSeenAt === 'string'
                ? result.output.firstSeenAt
                : null,
            deployId:
              typeof result.output.deployId === 'string'
                ? result.output.deployId
                : null,
            eventCount,
          },
        });
        break;
      }
      case 'inspect_recent_github_changes': {
        const relevantFiles = Array.isArray(result.output.relevantFiles)
          ? result.output.relevantFiles.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        const suspectPrs = Array.isArray(result.output.suspectPrs)
          ? result.output.suspectPrs.filter(
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
          typeof result.output.note === 'string' ? result.output.note : null;

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
        const stakeholders = toStakeholderMentions(result.output.stakeholders);

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
          typeof result.output.prNumber === 'string' ? result.output.prNumber : null;
        const title =
          typeof result.output.title === 'string' ? result.output.title : null;

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
          },
        });
        break;
      }
      case 'assign_incident_owner': {
        const owner =
          typeof result.output.owner === 'string' ? result.output.owner : null;

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
            typeof result.output.prNumber === 'string'
              ? `${result.output.prNumber} merged and rolling out`
              : 'Fix merged and rolling out',
          detail:
            typeof result.output.resolutionSummary === 'string'
              ? result.output.resolutionSummary
              : null,
          payload: {
            prNumber:
              typeof result.output.prNumber === 'string'
                ? result.output.prNumber
                : null,
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
          typeof result.output.clean === 'boolean' ? result.output.clean : false;
        const summary =
          typeof result.output.summary === 'string'
            ? result.output.summary
            : clean
              ? 'Monitoring is clean'
              : 'Monitoring detected recurring failures';

        milestones.push({
          ...base,
          kind:
            result.output.status === 'stabilized'
              ? 'incident_stabilized'
              : 'monitoring_clean',
          summary:
            result.output.status === 'stabilized'
              ? 'Incident stabilized after clean monitoring window'
              : summary,
          detail: summary,
          payload: {
            clean,
            errorCount:
              typeof result.output.errorCount === 'number'
                ? result.output.errorCount
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
