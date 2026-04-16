import { z } from 'zod';

export const incidentStatusSchema = z.enum([
  'new',
  'triage_started',
  'investigating',
  'stakeholders_notified',
  'fix_pr_opened',
  'owner_assigned',
  'fix_merged',
  'monitoring',
  'stabilized',
]);

export const incidentSeveritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export const incidentSourceSchema = z.enum(['monitoring', 'manual', 'replay']);

export const slackThreadRefSchema = z.object({
  channelId: z.string(),
  threadTs: z.string(),
});

export const timelineEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  timestamp: z.string(),
  summary: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});

export const healthCheckSummarySchema = z.object({
  clean: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  summary: z.string(),
});

export const incidentReportSchema = z.object({
  incidentId: z.string(),
  currentStatus: incidentStatusSchema,
  severity: incidentSeveritySchema,
  source: incidentSourceSchema,
  summary: z.string(),
  affectedArea: z.string(),
  suspectedCause: z.string().nullable(),
  sentrySignature: z.string().nullable(),
  relevantFiles: z.array(z.string()),
  relatedPrs: z.array(z.string()),
  notifiedStakeholders: z.array(z.string()),
  owner: z.string().nullable(),
  fixPrNumber: z.string().nullable(),
  resolutionNotes: z.array(z.string()),
  lastHealthCheck: healthCheckSummarySchema.nullable(),
});

export type IncidentStatus = z.infer<typeof incidentStatusSchema>;
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type IncidentSource = z.infer<typeof incidentSourceSchema>;
export type SlackThreadRef = z.infer<typeof slackThreadRefSchema>;
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export type HealthCheckSummary = z.infer<typeof healthCheckSummarySchema>;
export type IncidentReport = z.infer<typeof incidentReportSchema>;
