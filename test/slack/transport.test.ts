import { afterEach, describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentMilestone } from '../../src/agent/milestones';
import { IncidentStore } from '../../src/incidents/store';
import { SlackTransport } from '../../src/slack/transport';

const filePath = join(process.cwd(), 'tmp-test-slack-transport', 'incidents.json');

const makeMilestones = (incidentId: string): AgentMilestone[] => [
  {
    id: 'm1',
    incidentId,
    stepNumber: 0,
    kind: 'incident_detected',
    timestamp: '2026-04-16T10:03:00.000Z',
    summary: 'Detected repeated billing failures across 3 user events',
    detail: null,
    payload: { alertCount: 3, repeated: true },
  },
  {
    id: 'm2',
    incidentId,
    stepNumber: 1,
    kind: 'triage_started',
    timestamp: '2026-04-16T10:03:10.000Z',
    summary: `Initiated automated triage for ${incidentId}`,
    detail: 'Creating incident timeline and beginning evidence collection.',
    payload: {},
  },
  {
    id: 'm3',
    incidentId,
    stepNumber: 2,
    kind: 'sentry_evidence_found',
    timestamp: '2026-04-16T10:04:00.000Z',
    summary: 'Sentry correlation found 37 events for StripeError: No such payment_method',
    detail: 'Regression in fallback payment method lookup after recent billing deploy',
    payload: {
      signature: 'StripeError: No such payment_method',
      deployId: 'prod-2026.04.16.3',
      eventCount: 37,
    },
  },
  {
    id: 'm4',
    incidentId,
    stepNumber: 3,
    kind: 'github_evidence_found',
    timestamp: '2026-04-16T10:04:10.000Z',
    summary: 'GitHub evidence linked 3 suspect PRs and 3 relevant files',
    detail: 'Most relevant recent changes: PR #184, PR #181, PR #176',
    payload: {
      relevantFiles: [
        'apps/api/src/billing/renewSubscription.ts',
        'apps/api/src/lib/stripe/getDefaultPaymentMethod.ts',
        'apps/webhooks/src/handlers/customerUpdated.ts',
      ],
      suspectPrs: [
        'PR #184 Refactor default payment method lookup',
        'PR #181 Cleanup billing retry worker',
        'PR #176 Customer sync webhook changes',
      ],
    },
  },
  {
    id: 'm5',
    incidentId,
    stepNumber: 4,
    kind: 'report_updated',
    timestamp: '2026-04-16T10:05:00.000Z',
    summary: 'Updated live incident report',
    detail: 'Report updated with suspected PR #184 and billing-path evidence.',
    payload: {
      note: 'Report updated with suspected PR #184 and billing-path evidence.',
    },
  },
  {
    id: 'm6',
    incidentId,
    stepNumber: 5,
    kind: 'stakeholders_notified',
    timestamp: '2026-04-16T10:05:10.000Z',
    summary: 'Notified 3 stakeholders',
    detail: '@user1, @user2, @user3',
    payload: {
      stakeholders: ['@user1', '@user2', '@user3'],
    },
  },
  {
    id: 'm7',
    incidentId,
    stepNumber: 6,
    kind: 'fix_pr_opened',
    timestamp: '2026-04-16T10:06:00.000Z',
    summary: 'Opened candidate fix PR PR #188',
    detail: 'Fix fallback payment method resolution for subscription renewals',
    payload: {
      prNumber: 'PR #188',
      title: 'Fix fallback payment method resolution for subscription renewals',
    },
  },
  {
    id: 'm8',
    incidentId,
    stepNumber: 7,
    kind: 'owner_assigned',
    timestamp: '2026-04-16T10:06:20.000Z',
    summary: 'Incident assigned to @user1',
    detail: null,
    payload: {
      owner: '@user1',
    },
  },
  {
    id: 'm9',
    incidentId,
    stepNumber: 8,
    kind: 'fix_merged',
    timestamp: '2026-04-16T10:07:00.000Z',
    summary: 'PR #188 merged and rolling out',
    detail: 'Restore null fallback behavior for payment method resolution during renewals',
    payload: {
      prNumber: 'PR #188',
      resolutionSummary:
        'Restore null fallback behavior for payment method resolution during renewals',
    },
  },
  {
    id: 'm10',
    incidentId,
    stepNumber: 9,
    kind: 'monitoring_clean',
    timestamp: '2026-04-16T10:08:00.000Z',
    summary: 'Failures are still occurring immediately after deploy',
    detail: 'Failures are still occurring immediately after deploy',
    payload: {
      clean: false,
      errorCount: 12,
    },
  },
  {
    id: 'm11',
    incidentId,
    stepNumber: 10,
    kind: 'monitoring_clean',
    timestamp: '2026-04-16T10:14:00.000Z',
    summary: 'No new matching Sentry events in the last 6 minutes',
    detail: 'No new matching Sentry events in the last 6 minutes',
    payload: {
      clean: true,
      errorCount: 0,
    },
  },
  {
    id: 'm12',
    incidentId,
    stepNumber: 11,
    kind: 'incident_stabilized',
    timestamp: '2026-04-16T10:44:00.000Z',
    summary: 'Incident stabilized after clean monitoring window',
    detail: '30 minutes with no new recurring billing failures',
    payload: {},
  },
];

afterEach(async () => {
  await rm(join(process.cwd(), 'tmp-test-slack-transport'), {
    recursive: true,
    force: true,
  });
});

describe('SlackTransport', () => {
  test('starts crisis run, pauses for review confirmation, and then resumes rollout', async () => {
    const store = new IncidentStore(filePath);
    const seededIncident = await store.createIncidentFromScenario('billing-renewal');
    const postedMessages: Array<{
      channel: string;
      thread_ts: string;
      text: string;
    }> = [];

    const transport = new SlackTransport({
      incidentsChannelId: 'CINCIDENTS',
      workspaceName: 'Luminaris Holdings',
      appId: 'A0ATNQKJPHP',
      webClient: {
        chat: {
          postMessage: async (payload: {
            channel: string;
            thread_ts: string;
            text: string;
          }) => {
            postedMessages.push(payload);
            return {} as never;
          },
        },
      } as never,
      socketClient: {
        on() {},
        start: async () => {},
      } as never,
      commanderRunner: {
        runForBillingScenario: async () => ({
          runId: 'run-1',
          incident: seededIncident,
          result: {
            text: '',
            finishReason: 'stop',
            steps: [],
          },
          trace: [],
          milestones: makeMilestones(seededIncident.incidentId),
          transcript: [],
          summary: {
            totalSteps: 12,
            totalMilestones: 12,
            finalIncidentStatus: 'stabilized',
          },
        }),
      } as never,
      incidentStore: store,
    });

    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '1',
      text: 'Billing monitor: subscription renewal failed for user usr_1042',
      bot_id: 'BMONITOR',
    });
    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '2',
      text: 'StripeError: No such payment_method',
      bot_id: 'BMONITOR',
    });
    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '3',
      text: 'ALERT: subscription renewal failures exceeded threshold for 15m in prod.',
      bot_id: 'BMONITOR',
    });

    expect(postedMessages[0]?.text).toBe(
      'Detected repeated billing failures. Initiating automated RCA now.',
    );
    expect(
      postedMessages.some((message) =>
        message.text.includes('Invoking Codex to start the fix'),
      ),
    ).toBe(true);
    expect(
      postedMessages.some((message) =>
        message.text.includes('Waiting for human reviewer confirmation before merge.'),
      ),
    ).toBe(true);
    expect(
      postedMessages.some((message) =>
        message.text.includes('merged and rolling out now'),
      ),
    ).toBe(false);

    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '4',
      thread_ts: '3',
      text: 'looks good to me, ok to merge',
      user: 'UREVIEWER',
    });

    expect(
      postedMessages.some((message) =>
        message.text.includes('Review confirmed by <@UREVIEWER>'),
      ),
    ).toBe(true);
    expect(
      postedMessages.some((message) =>
        message.text.includes('merged and rolling out now'),
      ),
    ).toBe(true);
    expect(
      postedMessages.some((message) =>
        message.text.includes('Incident stabilized after clean monitoring window.'),
      ),
    ).toBe(true);

    const incident = await store.getIncident(seededIncident.incidentId);
    expect(incident?.slackThreadRef).toEqual({
      channelId: 'CINCIDENTS',
      threadTs: '3',
    });
  });

  test('records provider errors in-thread without crashing the transport', async () => {
    const store = new IncidentStore(filePath);

    const postedMessages: Array<{
      channel: string;
      thread_ts: string;
      text: string;
    }> = [];

    const transport = new SlackTransport({
      incidentsChannelId: 'CINCIDENTS',
      workspaceName: 'Luminaris Holdings',
      appId: 'A0ATNQKJPHP',
      webClient: {
        chat: {
          postMessage: async (payload: {
            channel: string;
            thread_ts: string;
            text: string;
          }) => {
            postedMessages.push(payload);
            return {} as never;
          },
        },
      } as never,
      socketClient: {
        on() {},
        start: async () => {},
      } as never,
      commanderRunner: {
        runForBillingScenario: async () => {
          throw new Error('OpenAI server_error');
        },
      } as never,
      incidentStore: store,
    });

    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '1',
      text: 'Billing monitor: subscription renewal failed for user usr_1042',
      bot_id: 'BMONITOR',
    });
    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '2',
      text: 'StripeError: No such payment_method',
      bot_id: 'BMONITOR',
    });
    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '3',
      text: 'ALERT: subscription renewal failures exceeded threshold for 15m in prod.',
      bot_id: 'BMONITOR',
    });

    expect(postedMessages).toHaveLength(2);
    expect(postedMessages[0]?.text).toBe(
      'Detected repeated billing failures. Initiating automated RCA now.',
    );
    expect(postedMessages[1]?.text).toBe(
      'Automated RCA paused due to a provider error.\nOpenAI server_error',
    );
    expect(transport.getStatus().lastError).toBe('OpenAI server_error');
  });

  test('swallows fallback Slack posting errors after a commander failure', async () => {
    const store = new IncidentStore(filePath);
    let postAttempts = 0;

    const transport = new SlackTransport({
      incidentsChannelId: 'CINCIDENTS',
      workspaceName: 'Luminaris Holdings',
      appId: 'A0ATNQKJPHP',
      webClient: {
        chat: {
          postMessage: async () => {
            postAttempts += 1;

            if (postAttempts === 2) {
              throw new Error('Slack post failed');
            }

            return {} as never;
          },
        },
      } as never,
      socketClient: {
        on() {},
        start: async () => {},
      } as never,
      commanderRunner: {
        runForBillingScenario: async () => {
          throw new Error('OpenAI server_error');
        },
      } as never,
      incidentStore: store,
    });

    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '1',
      text: 'Billing monitor: subscription renewal failed for user usr_1042',
      bot_id: 'BMONITOR',
    });
    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '2',
      text: 'StripeError: No such payment_method',
      bot_id: 'BMONITOR',
    });
    await transport.handleMessage({
      channel: 'CINCIDENTS',
      ts: '3',
      text: 'ALERT: subscription renewal failures exceeded threshold for 15m in prod.',
      bot_id: 'BMONITOR',
    });

    expect(postAttempts).toBe(2);
    expect(transport.getStatus().lastError).toBe('Slack post failed');
  });
});
