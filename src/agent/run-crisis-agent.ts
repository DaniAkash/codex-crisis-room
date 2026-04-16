import type { LanguageModel, StepResult } from 'ai';

import type { ScenarioEngine } from '../incidents/scenario-engine';
import { createCrisisAgent } from './crisis-agent';
import { createTraceRecorder, InMemoryAgentRunStore, makeAgentExecutionContext } from './trace';
import type { AgentRunRecord } from './types';

const summarizeStep = (step: StepResult<any>) => {
  if (step.toolCalls.length > 0) {
    return `Used tools: ${step.toolCalls.map((toolCall) => toolCall.toolName).join(', ')}`;
  }

  if (step.text) {
    return step.text.slice(0, 240);
  }

  return `Finished step with reason ${step.finishReason}`;
};

export class CrisisAgentRunner {
  private readonly runStore = new InMemoryAgentRunStore();

  constructor(
    private readonly scenarioEngine: ScenarioEngine,
    private readonly options?: {
      model?: LanguageModel;
    },
  ) {}

  async runForBillingScenario() {
    const incident = await this.scenarioEngine.startBillingRenewalIncident();
    return this.runForIncident(incident.incidentId);
  }

  async runForIncident(incidentId: string) {
    const incident = await this.scenarioEngine.getIncident(incidentId);

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const runId = crypto.randomUUID();
    const prompt = `A billing incident has been detected for incident ${incidentId}. Use tools to triage, investigate, coordinate, and resolve the incident. Leave behind structured state that can drive the demo transcript.`;
    this.runStore.create(runId, incidentId, prompt);

    const agent = createCrisisAgent(this.scenarioEngine, this.options);
    const traceRecorder = createTraceRecorder(this.runStore, runId);
    const executionContext = makeAgentExecutionContext(
      this.runStore,
      runId,
      incidentId,
    );

    const result = await agent.generate({
      prompt,
      options: {
        incidentId,
        executionContext,
      },
      onStepFinish: async (
        step: StepResult<typeof agent.tools>,
      ) => {
        traceRecorder.add({
          kind: 'step_finish',
          stepNumber: step.stepNumber,
          finishReason: step.finishReason,
          summary: summarizeStep(step),
          toolNames: step.toolCalls.map((toolCall) => toolCall.toolName),
          usage: step.usage,
          timestamp: new Date().toISOString(),
        });
      },
    });

    this.runStore.setLastText(runId, result.text);
    this.runStore.finish(
      runId,
      result.finishReason,
      result.text || 'Agent run completed',
    );

    return {
      runId,
      incident: await this.scenarioEngine.getIncident(incidentId),
      result: {
        text: result.text,
        finishReason: result.finishReason,
        steps: result.steps.map((step) => ({
          stepNumber: step.stepNumber,
          finishReason: step.finishReason,
          toolNames: step.toolCalls.map((toolCall) => toolCall.toolName),
          text: step.text,
        })),
      },
      trace: this.runStore.get(runId)?.trace ?? [],
    };
  }

  getRun(runId: string): AgentRunRecord | null {
    return this.runStore.get(runId);
  }
}
