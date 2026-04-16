import type { AgentExecutionContext, AgentRunRecord, AgentTraceEvent, TraceRecorder } from './types';

const summarizeOutput = (output: unknown) => {
  if (typeof output === 'string') {
    return output;
  }

  if (typeof output === 'object' && output !== null) {
    return JSON.stringify(output).slice(0, 240);
  }

  return String(output);
};

export class InMemoryAgentRunStore {
  private readonly runs = new Map<string, AgentRunRecord>();

  create(runId: string, incidentId: string, prompt: string): AgentRunRecord {
    const run: AgentRunRecord = {
      runId,
      incidentId,
      prompt,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      finishReason: null,
      trace: [],
      milestones: [],
      transcript: [],
      lastText: '',
      summary: {
        totalSteps: 0,
        totalMilestones: 0,
        finalIncidentStatus: null,
      },
    };

    this.runs.set(runId, run);
    return run;
  }

  get(runId: string) {
    return this.runs.get(runId) ?? null;
  }

  setLastText(runId: string, text: string) {
    const run = this.get(runId);
    if (run) {
      run.lastText = text;
    }
  }

  finish(runId: string, finishReason: string, summary: string) {
    const run = this.get(runId);
    if (!run) return;

    run.finishReason = finishReason;
    run.finishedAt = new Date().toISOString();
    run.trace.push({
      kind: 'run_finish',
      finishReason,
      summary,
      timestamp: new Date().toISOString(),
    });
  }

  setDerivedOutputs(
    runId: string,
    derived: Pick<AgentRunRecord, 'milestones' | 'transcript' | 'summary'>,
  ) {
    const run = this.get(runId);

    if (!run) {
      return;
    }

    run.milestones = derived.milestones;
    run.transcript = derived.transcript;
    run.summary = derived.summary;
  }
}

export const createTraceRecorder = (
  runStore: InMemoryAgentRunStore,
  runId: string,
): TraceRecorder => ({
  add(event: AgentTraceEvent) {
    const run = runStore.get(runId);
    if (run) {
      run.trace.push(event);
    }
  },
});

export const summarizeToolOutput = summarizeOutput;

export const makeAgentExecutionContext = (
  runStore: InMemoryAgentRunStore,
  runId: string,
  incidentId: string,
): AgentExecutionContext => ({
  runId,
  incidentId,
  currentStepNumber: undefined,
  traceRecorder: createTraceRecorder(runStore, runId),
});
