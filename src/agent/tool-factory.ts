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
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'detect_repeated_incident', {
        incidentId: context.incidentId,
      });
      const detection = await scenarioEngine.detectRepeatedIncident(
        context.incidentId,
      );
      const incident = await scenarioEngine.getIncident(context.incidentId);

      if (!incident) {
        throw new Error(`Incident ${context.incidentId} not found`);
      }

      const output = {
        incident,
        payload: detection,
      };
      recordToolResult(context, 'detect_repeated_incident', output);
      return output;
    },
  }),
  start_triage: tool({
    description: 'Start automated triage for the active incident.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'start_triage', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.startTriage(context.incidentId);
      recordToolResult(context, 'start_triage', output);
      return output;
    },
  }),
  read_sentry_signals: tool({
    description:
      'Inspect repeated Sentry-style error trails for the active incident.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'read_sentry_signals', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.getSentryEvidence(context.incidentId);
      recordToolResult(context, 'read_sentry_signals', output);
      return output;
    },
  }),
  inspect_recent_github_changes: tool({
    description:
      'Inspect recent GitHub-style changes to find suspect PRs and relevant files.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'inspect_recent_github_changes', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.getGithubEvidence(context.incidentId);
      recordToolResult(context, 'inspect_recent_github_changes', output);
      return output;
    },
  }),
  update_incident_report: tool({
    description:
      'Persist a concise investigation or RCA note into the incident report.',
    inputSchema: z.object({
      note: z.string().min(1),
    }),
    execute: async ({ note }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'update_incident_report', {
        incidentId: context.incidentId,
        note,
      });
      const output = await scenarioEngine.updateIncidentReport(
        context.incidentId,
        note,
      );
      recordToolResult(context, 'update_incident_report', output);
      return output;
    },
  }),
  notify_stakeholders: tool({
    description:
      'Notify the incident stakeholders once the evidence is strong enough.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'notify_stakeholders', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.notifyStakeholders(
        context.incidentId,
      );
      recordToolResult(context, 'notify_stakeholders', output);
      return output;
    },
  }),
  open_fix_pr: tool({
    description:
      'Open the candidate fix PR once the likely regression path is understood.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'open_fix_pr', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.openFixPr(context.incidentId);
      recordToolResult(context, 'open_fix_pr', output);
      return output;
    },
  }),
  assign_incident_owner: tool({
    description:
      'Assign a human incident owner once the responder has engaged.',
    inputSchema: z.object({
      owner: z.string().min(1),
    }),
    execute: async ({ owner }, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'assign_incident_owner', {
        incidentId: context.incidentId,
        owner,
      });
      const output = await scenarioEngine.assignOwner(context.incidentId, owner);
      recordToolResult(context, 'assign_incident_owner', output);
      return output;
    },
  }),
  merge_fix: tool({
    description:
      'Record that the fix PR has been merged and the fix is live shortly.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'merge_fix', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.mergeFix(context.incidentId);
      recordToolResult(context, 'merge_fix', output);
      return output;
    },
  }),
  start_monitoring: tool({
    description:
      'Move the incident into monitoring after the fix has been merged.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'start_monitoring', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.startMonitoring(context.incidentId);
      recordToolResult(context, 'start_monitoring', output);
      return output;
    },
  }),
  check_prod_health: tool({
    description:
      'Check whether production is still failing or has stabilized.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'check_prod_health', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.checkHealth(context.incidentId);
      recordToolResult(context, 'check_prod_health', output);
      return output;
    },
  }),
  get_incident_state: tool({
    description:
      'Read the current high-level incident status, report, and timeline state.',
    inputSchema: z.object({}),
    execute: async (_, { experimental_context }) => {
      const context = toolContextSchema.parse(experimental_context);
      recordToolCall(context, 'get_incident_state', {
        incidentId: context.incidentId,
      });
      const output = await scenarioEngine.getIncidentState(context.incidentId);
      recordToolResult(context, 'get_incident_state', output);
      return output;
    },
  }),
});
