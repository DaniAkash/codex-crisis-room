import type { SocketModeClient } from '@slack/socket-mode';
import type { WebClient } from '@slack/web-api';

import type { CrisisAgentRunner } from '../agent/run-crisis-agent';
import type { IncidentStore } from '../incidents/store';
import { renderSlackMessage } from './render';
import { SlackTriggerDetector } from './trigger-detector';
import type { SlackMessageEvent, SlackStatus } from './types';

type SlackTransportDeps = {
  appId?: string | null;
  workspaceName?: string | null;
  incidentsChannelId: string;
  webClient: Pick<WebClient, 'chat'>;
  socketClient: Pick<SocketModeClient, 'on' | 'start'>;
  commanderRunner: CrisisAgentRunner;
  incidentStore: IncidentStore;
};

export class SlackTransport {
  private readonly triggerDetector: SlackTriggerDetector;
  private readonly activeThreads = new Set<string>();
  private status: SlackStatus;

  constructor(private readonly deps: SlackTransportDeps) {
    this.triggerDetector = new SlackTriggerDetector(deps.incidentsChannelId);
    this.status = {
      connected: false,
      initialized: false,
      workspaceName: deps.workspaceName ?? null,
      appId: deps.appId ?? null,
      incidentsChannelId: deps.incidentsChannelId,
      lastError: null,
    };
  }

  async start() {
    this.deps.socketClient.on('slack_event', async ({ ack, body }: any) => {
      await ack();

      if (body?.event?.type !== 'message') {
        return;
      }

      await this.handleMessage(body.event as SlackMessageEvent);
    });

    await this.deps.socketClient.start();
    this.status = {
      ...this.status,
      connected: true,
      initialized: true,
    };
  }

  getStatus(): SlackStatus {
    return this.status;
  }

  async handleMessage(event: SlackMessageEvent) {
    const decision = this.triggerDetector.evaluate(event);

    if (!decision.triggered) {
      return decision;
    }

    const threadKey = `${event.channel}:${decision.threadTs}`;

    if (this.activeThreads.has(threadKey)) {
      return decision;
    }

    this.activeThreads.add(threadKey);

    try {
      await this.deps.webClient.chat.postMessage({
        channel: event.channel,
        thread_ts: decision.threadTs,
        text:
          decision.reason === 'manual-kickoff'
            ? 'Manual kickoff received. Initiating automated RCA now.'
            : 'Detected repeated billing failures. Initiating automated RCA now.',
      });

      const run = await this.deps.commanderRunner.runForBillingScenario();

      if (run.incident) {
        await this.deps.incidentStore.attachSlackThread(run.incident.incidentId, {
          channelId: event.channel,
          threadTs: decision.threadTs,
        });
      }

      for (const entry of run.transcript) {
        await this.deps.webClient.chat.postMessage({
          channel: event.channel,
          thread_ts: decision.threadTs,
          text: renderSlackMessage(entry),
        });
      }

      return decision;
    } catch (error) {
      this.status = {
        ...this.status,
        lastError: error instanceof Error ? error.message : String(error),
      };
      throw error;
    } finally {
      this.activeThreads.delete(threadKey);
    }
  }
}
