import { afterEach, describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import { MockLanguageModelV3 } from 'ai/test';

import { CrisisAgentRunner } from '../../src/agent/run-crisis-agent';
import { ScenarioEngine } from '../../src/incidents/scenario-engine';
import { IncidentStore } from '../../src/incidents/store';

const filePath = join(process.cwd(), 'tmp-test-agent', 'incidents.json');

const usage = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 0,
    text: 0,
    reasoning: 0,
  },
} as const;

const makeToolResult = (
  toolName: string,
  input: Record<string, unknown>,
  toolCallId: string,
): LanguageModelV3GenerateResult => ({
  content: [
    {
      type: 'tool-call',
      toolCallId,
      toolName,
      input: JSON.stringify(input),
    },
  ],
  finishReason: {
    unified: 'tool-calls',
    raw: 'tool-calls',
  },
  usage,
  warnings: [],
});

afterEach(async () => {
  await rm(join(process.cwd(), 'tmp-test-agent'), {
    recursive: true,
    force: true,
  });
});

describe('CrisisAgentRunner', () => {
  test('drives the seeded billing incident to stabilization with the commander tool loop', async () => {
    const store = new IncidentStore(filePath);
    const engine = new ScenarioEngine(store);

    const toolSequence = [
      makeToolResult('detect_repeated_incident', {}, 'call-1'),
      makeToolResult('start_triage', {}, 'call-2'),
      makeToolResult('read_sentry_signals', {}, 'call-3'),
      makeToolResult(
        'update_incident_report',
        {
          note: 'Sentry shows repeated renewal failures after deploy-2026-04-16-0912.',
        },
        'call-4',
      ),
      makeToolResult('inspect_recent_github_changes', {}, 'call-5'),
      makeToolResult(
        'update_incident_report',
        {
          note: 'Recent billing retry changes in PR #184 likely introduced the regression path.',
        },
        'call-6',
      ),
      makeToolResult('notify_stakeholders', {}, 'call-7'),
      makeToolResult('open_fix_pr', {}, 'call-8'),
      makeToolResult(
        'assign_incident_owner',
        { owner: '@user1' },
        'call-9',
      ),
      makeToolResult('merge_fix', {}, 'call-10'),
      makeToolResult('start_monitoring', {}, 'call-11'),
      makeToolResult('check_prod_health', {}, 'call-12'),
      makeToolResult('check_prod_health', {}, 'call-13'),
      makeToolResult('check_prod_health', {}, 'call-14'),
      makeToolResult(
        'done',
        { reason: 'Monitoring window is clean and the incident is stabilized.' },
        'call-15',
      ),
    ];

    let callIndex = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => toolSequence[callIndex++] ?? toolSequence.at(-1)!,
    });

    const runner = new CrisisAgentRunner(engine, { model });
    const run = await runner.runForBillingScenario();

    expect(run.incident?.status).toBe('stabilized');
    expect(run.incident?.report.currentStatus).toBe('stabilized');
    expect(run.incident?.report.owner).toBe('@user1');
    expect(run.result.steps.map((step) => step.toolNames[0])).toEqual([
      'detect_repeated_incident',
      'start_triage',
      'read_sentry_signals',
      'update_incident_report',
      'inspect_recent_github_changes',
      'update_incident_report',
      'notify_stakeholders',
      'open_fix_pr',
      'assign_incident_owner',
      'merge_fix',
      'start_monitoring',
      'check_prod_health',
      'check_prod_health',
      'check_prod_health',
      'done',
    ]);
    expect(run.trace.some((event) => event.kind === 'tool_result')).toBe(true);
    expect(run.trace.at(-1)?.kind).toBe('run_finish');
  });
});
