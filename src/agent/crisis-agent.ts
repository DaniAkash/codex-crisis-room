import {
  hasToolCall,
  stepCountIs,
  ToolLoopAgent,
  tool,
  type LanguageModel,
} from 'ai';
import { z } from 'zod';

import type { ScenarioEngine } from '../incidents/scenario-engine';
import { getCommanderTools } from './tools';
import { commanderModel } from './model';
import type { AgentExecutionContext, CommanderCallOptions } from './types';

const commanderInstructions = `
You are Crisis Bot, the incident commander for a production billing incident.

Your job is to:
- confirm the incident pattern
- gather evidence using tools
- update the incident report continuously
- notify stakeholders when evidence is strong enough
- open a candidate fix path when justified
- assign an owner when a human responder is engaged
- begin monitoring after the fix is merged
- mark the incident complete only when the monitoring evidence supports stabilization

Rules:
- Never claim system state without a tool result.
- Prefer tools over speculation.
- Avoid redundant tool calls.
- Keep updates concise and operational.
- Once a phase-changing tool succeeds, move to the next required action instead of repeating report updates.
- The active incident ID is provided by runtime context. Never guess or invent incident IDs.
- Gather enough detail that a downstream communication layer can say:
  - what failed
  - what Sentry found
  - which files and PRs are suspect
  - who was notified
  - what fix PR was opened
  - who owns the incident
  - whether monitoring is clean
- Use the done tool only when the incident is stabilized or explicitly handed off.
`;

const toolsForStatus = {
  new: ['detect_repeated_incident', 'start_triage'],
  triage_started: ['read_sentry_signals', 'update_incident_report'],
  investigating: [
    'inspect_recent_github_changes',
    'update_incident_report',
    'notify_stakeholders',
  ],
  stakeholders_notified: ['open_fix_pr'],
  fix_pr_opened: ['assign_incident_owner'],
  owner_assigned: ['merge_fix'],
  fix_merged: ['start_monitoring'],
  monitoring: ['check_prod_health'],
  stabilized: ['done'],
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const incidentIsStabilized = ({ steps }: { steps: Array<any> }) => {
  const lastStep = steps.at(-1);

  if (!lastStep) {
    return false;
  }

  return lastStep.toolResults.some((toolResult: any) => {
    if (toolResult.toolName !== 'check_prod_health' || !isRecord(toolResult.output)) {
      return false;
    }

    return toolResult.output.status === 'stabilized';
  });
};

const executionContextSchema = z.custom<AgentExecutionContext>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'runId' in value &&
    'incidentId' in value &&
    'traceRecorder' in value,
  'Expected agent execution context',
);

const commanderCallOptionsSchema = z.object({
  executionContext: executionContextSchema,
});

export const createCrisisAgent = (
  scenarioEngine: ScenarioEngine,
  options?: {
    model?: LanguageModel;
  },
) => {
  const commanderTools = getCommanderTools(scenarioEngine);
  const doneTool = tool({
    description:
      'Signal that the incident loop is complete because the incident has stabilized or been handed off.',
    inputSchema: z.object({
      reason: z.string().min(1),
    }),
  });
  const tools = {
    ...commanderTools,
    done: doneTool,
  };

  return new ToolLoopAgent<CommanderCallOptions, typeof tools>({
    id: 'crisis-commander',
    model: options?.model ?? commanderModel(),
    callOptionsSchema: commanderCallOptionsSchema,
    instructions: commanderInstructions,
    toolChoice: 'required',
    providerOptions: {
      openai: {
        parallelToolCalls: false,
        maxToolCalls: 1,
      },
    },
    tools,
    stopWhen: [stepCountIs(20), hasToolCall('done'), incidentIsStabilized],
    prepareCall: ({ options: callOptions, ...settings }) => ({
      ...settings,
      experimental_context: callOptions.executionContext,
    }),
    prepareStep: async ({ experimental_context, stepNumber }) => {
      const context = executionContextSchema.parse(experimental_context);
      const incidentId = context.incidentId;

      const incident = await scenarioEngine.getIncident(incidentId);

      if (!incident) {
        return {};
      }

      return {
        experimental_context: {
          ...context,
          currentStepNumber: stepNumber,
        },
        activeTools: [...toolsForStatus[incident.status]],
        toolChoice: 'required',
      };
    },
  });
};
