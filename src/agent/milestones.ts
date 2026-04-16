import { z } from 'zod';

export const agentMilestoneKindSchema = z.enum([
  'incident_detected',
  'triage_started',
  'sentry_evidence_found',
  'github_evidence_found',
  'report_updated',
  'stakeholders_notified',
  'fix_pr_opened',
  'owner_assigned',
  'fix_merged',
  'monitoring_started',
  'monitoring_clean',
  'incident_stabilized',
]);

export const agentMilestoneSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  stepNumber: z.number().int().nonnegative(),
  kind: agentMilestoneKindSchema,
  timestamp: z.string(),
  summary: z.string(),
  detail: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
});

export type AgentMilestoneKind = z.infer<typeof agentMilestoneKindSchema>;
export type AgentMilestone = z.infer<typeof agentMilestoneSchema>;
