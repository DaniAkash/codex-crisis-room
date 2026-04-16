import type {
  IncidentMachineContext,
  IncidentMachineEvent,
  TimelineEntry,
} from './types';

const summarizeEvent = (
  event: IncidentMachineEvent,
  context: IncidentMachineContext,
) => {
  switch (event.type) {
    case 'REPORT_UPDATED':
      return `Incident report updated: ${event.note}`;
    case 'START_TRIAGE':
      return `Automated triage started for ${context.report.affectedArea}`;
    case 'SENTRY_EVIDENCE_FOUND':
      return `Sentry correlation found ${event.signature} after deploy ${event.deployId}`;
    case 'GITHUB_EVIDENCE_FOUND':
      return `GitHub evidence identified ${event.suspectPrs.length} suspect PRs`;
    case 'STAKEHOLDERS_NOTIFIED':
      return `Notified stakeholders: ${event.stakeholders.join(', ')}`;
    case 'FIX_PR_OPENED':
      return `Opened candidate fix PR ${event.prNumber}`;
    case 'OWNER_ASSIGNED':
      return `Assigned incident owner ${event.owner}`;
    case 'FIX_MERGED':
      return `Merged fix PR ${event.prNumber}`;
    case 'START_MONITORING':
      return 'Started monitoring after fix deploy';
    case 'HEALTH_CHECK_CLEAN':
      return `Health check clean with ${event.errorCount} matching errors`;
    case 'HEALTH_CHECK_FAILED':
      return `Health check still failing with ${event.errorCount} matching errors`;
  }
};

export const makeTimelineEntry = (
  event: IncidentMachineEvent,
  context: IncidentMachineContext,
): TimelineEntry => ({
  id: crypto.randomUUID(),
  kind: event.type,
  timestamp: new Date().toISOString(),
  summary: summarizeEvent(event, context),
  metadata: event,
});

export const makeAlertBurstEntry = (alerts: { userId: string; message: string }[]) =>
  ({
    id: crypto.randomUUID(),
    kind: 'ALERT_BURST',
    timestamp: new Date().toISOString(),
    summary: `Received ${alerts.length} repeated billing alerts`,
    metadata: {
      alerts,
    },
  }) satisfies TimelineEntry;
