import { z } from 'zod';

import {
  incidentMachineSnapshotSchema,
  incidentReportSchema,
  incidentStatusSchema,
  slackThreadRefSchema,
  timelineEntrySchema,
} from './types';

export const persistedIncidentSchema = z.object({
  incidentId: z.string(),
  scenarioId: z.string(),
  status: incidentStatusSchema,
  report: incidentReportSchema,
  timeline: z.array(timelineEntrySchema),
  slackThreadRef: slackThreadRefSchema.optional(),
  machineSnapshot: incidentMachineSnapshotSchema,
});

export const persistedStoreSchema = z.object({
  incidents: z.array(persistedIncidentSchema),
  nextIncidentNumber: z.number().int().nonnegative(),
});

export type PersistedIncident = z.infer<typeof persistedIncidentSchema>;
export type PersistedStore = z.infer<typeof persistedStoreSchema>;
