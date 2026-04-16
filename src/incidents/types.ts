import type { Snapshot } from 'xstate';
import { z } from 'zod';

import {
  incidentReportSchema,
  incidentSeveritySchema,
  incidentSourceSchema,
  incidentStatusSchema,
  slackThreadRefSchema,
  timelineEntrySchema,
  type IncidentReport,
  type IncidentSeverity,
  type IncidentSource,
  type IncidentStatus,
  type SlackThreadRef,
  type TimelineEntry,
} from '../reporting/types';

export const scenarioAlertSchema = z.object({
  userId: z.string(),
  message: z.string(),
});

export const scenarioSentryEvidenceSchema = z.object({
  signature: z.string(),
  firstSeenAt: z.string(),
  eventCount: z.number().int().nonnegative(),
  deployId: z.string(),
  suspectedCause: z.string(),
});

export const scenarioGithubEvidenceSchema = z.object({
  relevantFiles: z.array(z.string()),
  suspectPrs: z.array(z.string()),
});

export const scenarioFixSchema = z.object({
  suspectPr: z.string(),
  fixPr: z.string(),
  title: z.string(),
  resolutionSummary: z.string(),
});

export const monitoringCheckSchema = z.object({
  clean: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  summary: z.string(),
});

export const billingScenarioSchema = z.object({
  id: z.literal('billing-renewal'),
  source: incidentSourceSchema,
  severity: incidentSeveritySchema,
  affectedArea: z.string(),
  summary: z.string(),
  alerts: z.array(scenarioAlertSchema),
  sentryEvidence: scenarioSentryEvidenceSchema,
  githubEvidence: scenarioGithubEvidenceSchema,
  stakeholders: z.array(z.string()),
  fix: scenarioFixSchema,
  monitoringChecks: z.array(monitoringCheckSchema),
  requiredCleanHealthChecks: z.number().int().positive(),
});

export const humanActionSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  timestamp: z.string(),
  note: z.string().optional(),
});

export const incidentMachineSnapshotSchema = z.custom<Snapshot<unknown>>(
  (value) => typeof value === 'object' && value !== null,
  'Expected a persisted XState snapshot object',
);

export const incidentSchema = z.object({
  incidentId: z.string(),
  scenarioId: z.string(),
  status: incidentStatusSchema,
  report: incidentReportSchema,
  timeline: z.array(timelineEntrySchema),
  slackThreadRef: slackThreadRefSchema.optional(),
});

export type BillingScenario = z.infer<typeof billingScenarioSchema>;
export type HumanAction = z.infer<typeof humanActionSchema>;
export type Incident = z.infer<typeof incidentSchema>;

export type IncidentMachineContext = {
  incidentId: string;
  scenarioId: string;
  report: IncidentReport;
  timeline: TimelineEntry[];
  cleanHealthChecks: number;
  requiredCleanHealthChecks: number;
  monitoringCheckIndex: number;
};

export type IncidentMachineEvent =
  | { type: 'REPORT_UPDATED'; note: string }
  | { type: 'START_TRIAGE' }
  | {
      type: 'SENTRY_EVIDENCE_FOUND';
      signature: string;
      suspectedCause: string;
      firstSeenAt: string;
      deployId: string;
      eventCount: number;
    }
  | {
      type: 'GITHUB_EVIDENCE_FOUND';
      suspectPrs: string[];
      relevantFiles: string[];
    }
  | { type: 'STAKEHOLDERS_NOTIFIED'; stakeholders: string[] }
  | { type: 'FIX_PR_OPENED'; prNumber: string; title: string }
  | { type: 'OWNER_ASSIGNED'; owner: string }
  | { type: 'FIX_MERGED'; prNumber: string; resolutionSummary: string }
  | { type: 'START_MONITORING' }
  | { type: 'HEALTH_CHECK_CLEAN'; errorCount: number; summary: string }
  | { type: 'HEALTH_CHECK_FAILED'; errorCount: number; summary: string };

export type IncidentRecord = {
  incidentId: string;
  scenarioId: string;
  status: IncidentStatus;
  report: IncidentReport;
  timeline: TimelineEntry[];
  slackThreadRef?: SlackThreadRef;
  machineSnapshot: Snapshot<unknown>;
};

export type IncidentSummary = Incident;

export type RepeatedIncidentDetection = {
  incidentId: string;
  repeated: boolean;
  alertCount: number;
  summary: string;
};

export {
  incidentReportSchema,
  incidentSeveritySchema,
  incidentSourceSchema,
  incidentStatusSchema,
  slackThreadRefSchema,
  timelineEntrySchema,
};
export type {
  IncidentReport,
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
  SlackThreadRef,
  TimelineEntry,
};
