import type { AgentMilestone } from '../agent/milestones';

export type TranscriptSpeaker = 'Crisis Bot' | 'System';

export type TranscriptEntry = {
  id: string;
  incidentId: string;
  speaker: TranscriptSpeaker;
  category: string;
  summary: string;
  body: string | null;
  mentions: string[];
  timestamp: string;
};

const toBody = (milestone: AgentMilestone): string | null => {
  switch (milestone.kind) {
    case 'incident_detected':
    case 'triage_started':
    case 'sentry_evidence_found':
    case 'github_evidence_found':
    case 'report_updated':
    case 'fix_pr_opened':
    case 'owner_assigned':
    case 'fix_merged':
    case 'monitoring_started':
    case 'monitoring_clean':
    case 'incident_stabilized':
      return milestone.detail;
    case 'stakeholders_notified':
      return milestone.detail;
  }
};

const toMentions = (milestone: AgentMilestone): string[] =>
  milestone.kind === 'stakeholders_notified' &&
  Array.isArray(milestone.payload.stakeholders)
    ? milestone.payload.stakeholders.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];

export const buildTranscriptFromMilestones = (
  milestones: AgentMilestone[],
): TranscriptEntry[] =>
  milestones.map((milestone) => ({
    id: crypto.randomUUID(),
    incidentId: milestone.incidentId,
    speaker: 'Crisis Bot',
    category: milestone.kind,
    summary: milestone.summary,
    body: toBody(milestone),
    mentions: toMentions(milestone),
    timestamp: milestone.timestamp,
  }));
