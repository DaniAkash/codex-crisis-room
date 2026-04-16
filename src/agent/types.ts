import type { LanguageModelUsage } from 'ai';

export type AgentTraceEvent =
  | {
      kind: 'tool_call';
      stepNumber: number;
      toolName: string;
      summary: string;
      input: unknown;
      timestamp: string;
    }
  | {
      kind: 'tool_result';
      stepNumber: number;
      toolName: string;
      summary: string;
      output: unknown;
      timestamp: string;
    }
  | {
      kind: 'step_finish';
      stepNumber: number;
      finishReason: string;
      summary: string;
      toolNames: string[];
      usage: LanguageModelUsage;
      timestamp: string;
    }
  | {
      kind: 'run_finish';
      finishReason: string;
      summary: string;
      timestamp: string;
    };

export type AgentRunRecord = {
  runId: string;
  incidentId: string;
  prompt: string;
  startedAt: string;
  finishedAt: string | null;
  finishReason: string | null;
  trace: AgentTraceEvent[];
  lastText: string;
};

export type AgentExecutionContext = {
  runId: string;
  incidentId: string;
  currentStepNumber?: number;
  traceRecorder: TraceRecorder;
};

export type CommanderCallOptions = {
  incidentId: string;
  executionContext: AgentExecutionContext;
};

export interface TraceRecorder {
  add(event: AgentTraceEvent): void;
}
