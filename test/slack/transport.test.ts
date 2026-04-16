import { afterEach, describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { IncidentStore } from '../../src/incidents/store';
import { SlackTransport } from '../../src/slack/transport';

const filePath = join(process.cwd(), 'tmp-test-slack-transport', 'incidents.json');

afterEach(async () => {
  await rm(join(process.cwd(), 'tmp-test-slack-transport'), {
    recursive: true,
    force: true,
  });
});

describe('SlackTransport', () => {
  test('starts crisis run after 3 consecutive alerts and attaches thread mapping', async () => {
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
            finishReason: 'tool-calls',
            steps: [],
          },
          trace: [],
          milestones: [],
          transcript: [
            {
              id: 'tr-1',
              incidentId: seededIncident.incidentId,
              speaker: 'Crisis Bot',
              category: 'triage_started',
              summary: 'Initiated automated triage for INC-001',
              body: 'Creating incident timeline and beginning evidence collection.',
              mentions: [],
              timestamp: new Date().toISOString(),
            },
          ],
          summary: {
            totalSteps: 1,
            totalMilestones: 1,
            finalIncidentStatus: seededIncident.status,
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

    expect(postedMessages).toHaveLength(2);
    expect(postedMessages[0]).toMatchObject({
      channel: 'CINCIDENTS',
      thread_ts: '3',
      text: 'Detected repeated billing failures. Initiating automated RCA now.',
    });
    expect(postedMessages[1]).toMatchObject({
      channel: 'CINCIDENTS',
      thread_ts: '3',
      text: 'Initiated automated triage for INC-001\nCreating incident timeline and beginning evidence collection.',
    });

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
