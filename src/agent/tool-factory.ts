import { tool } from 'ai';
import { z } from 'zod';

import type { ScenarioEngine } from '../incidents/scenario-engine';
import type { AgentExecutionContext } from './types';
import { summarizeToolOutput } from './trace';

type ToolContext = AgentExecutionContext;

const toolContextSchema = z.custom<ToolContext>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'runId' in value &&
    'incidentId' in value &&
    'traceRecorder' in value,
  'Expected agent execution context',
);

const recordToolCall = (
  context: ToolContext,
  toolName: string,
  input: unknown,
) => {
  context.traceRecorder.add({
    kind: 'tool_call',
    stepNumber: context.currentStepNumber ?? -1,
    toolName,
    summary: `Calling ${toolName}`,
    input,
    timestamp: new Date().toISOString(),
  });
};

const recordToolResult = (
  context: ToolContext,
  toolName: string,
  output: unknown,
) => {
  context.traceRecorder.add({
    kind: 'tool_result',
    stepNumber: context.currentStepNumber ?? -1,
    toolName,
    summary: summarizeToolOutput(output),
    output,
    timestamp: new Date().toISOString(),
  });
};

export const createCommanderTools = (scenarioEngine: ScenarioEngine) => ({
  detect_repeated_incident: tool({
    description:
      'Detect whether the active incident represents repeated production failures worth triaging.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'detect_repeated_incident', { incidentId });
      const output = await scenarioEngine.detectRepeatedIncident(incidentId);
      recordToolResult(context, 'detect_repeated_incident', output);
      return output;
    },
  }),
  start_triage: tool({
    description: 'Start automated triage for the active incident.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'start_triage', { incidentId });
      const output = await scenarioEngine.startTriage(incidentId);
      recordToolResult(context, 'start_triage', output);
      return output;
    },
  }),
  read_sentry_signals: tool({
    description:
      'Inspect repeated Sentry-style error trails for the active incident.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'read_sentry_signals', { incidentId });
      const output = await scenarioEngine.getSentryEvidence(incidentId);
      recordToolResult(context, 'read_sentry_signals', output);
      return output;
    },
  }),
  inspect_recent_github_changes: tool({
    description:
      'Inspect recent GitHub-style changes to find suspect PRs and relevant files.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'inspect_recent_github_changes', { incidentId });
      const output = await scenarioEngine.getGithubEvidence(incidentId);
      recordToolResult(context, 'inspect_recent_github_changes', output);
      return output;
    },
  }),
  update_incident_report: tool({
    description:
      'Persist a concise investigation or RCA note into the incident report.',
    inputSchema: z.object({
      incidentId: z.string(),
      note: z.string().min(1),
    }),
    execute: async ({ incidentId, note }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'update_incident_report', { incidentId, note });
      const output = await scenarioEngine.updateIncidentReport(incidentId, note);
      recordToolResult(context, 'update_incident_report', output);
      return output;
    },
  }),
  notify_stakeholders: tool({
    description:
      'Notify the incident stakeholders once the evidence is strong enough.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'notify_stakeholders', { incidentId });
      const output = await scenarioEngine.notifyStakeholders(incidentId);
      recordToolResult(context, 'notify_stakeholders', output);
      return output;
    },
  }),
  open_fix_pr: tool({
    description:
      'Open the candidate fix PR once the likely regression path is understood.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'open_fix_pr', { incidentId });
      const output = await scenarioEngine.openFixPr(incidentId);
      recordToolResult(context, 'open_fix_pr', output);
      return output;
    },
  }),
  assign_incident_owner: tool({
    description:
      'Assign a human incident owner once the responder has engaged.',
    inputSchema: z.object({
      incidentId: z.string(),
      owner: z.string().min(1),
    }),
    execute: async ({ incidentId, owner }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'assign_incident_owner', { incidentId, owner });
      const output = await scenarioEngine.assignOwner(incidentId, owner);
      recordToolResult(context, 'assign_incident_owner', output);
      return output;
    },
  }),
  merge_fix: tool({
    description:
      'Record that the fix PR has been merged and the fix is live shortly.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'merge_fix', { incidentId });
      const output = await scenarioEngine.mergeFix(incidentId);
      recordToolResult(context, 'merge_fix', output);
      return output;
    },
  }),
  start_monitoring: tool({
    description:
      'Move the incident into monitoring after the fix has been merged.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'start_monitoring', { incidentId });
      const output = await scenarioEngine.startMonitoring(incidentId);
      recordToolResult(context, 'start_monitoring', output);
      return output;
    },
  }),
  check_prod_health: tool({
    description:
      'Check whether production is still failing or has stabilized.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'check_prod_health', { incidentId });
      const output = await scenarioEngine.checkHealth(incidentId);
      recordToolResult(context, 'check_prod_health', output);
      return output;
    },
  }),
  get_incident_state: tool({
    description:
      'Read the current high-level incident status, report, and timeline state.',
    inputSchema: z.object({
      incidentId: z.string(),
    }),
    execute: async ({ incidentId }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'get_incident_state', { incidentId });
      const output = await scenarioEngine.getIncidentState(incidentId);
      recordToolResult(context, 'get_incident_state', output);
      return output;
    },
  }),
});
