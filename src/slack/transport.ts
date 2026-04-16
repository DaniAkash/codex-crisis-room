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
      try {
        await ack();

        if (body?.event?.type !== 'message') {
          return;
        }

        await this.handleMessage(body.event as SlackMessageEvent);
      } catch (error) {
        this.recordError(error);
      }
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

  private recordError(error: unknown) {
    this.status = {
      ...this.status,
      lastError: error instanceof Error ? error.message : String(error),
    };
  }

  private async postThreadMessage(
    channel: string,
    threadTs: string,
    text: string,
  ) {
    return this.deps.webClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text,
    });
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
      await this.postThreadMessage(
        event.channel,
        decision.threadTs,
        decision.reason === 'manual-kickoff'
          ? 'Manual kickoff received. Initiating automated RCA now.'
          : 'Detected repeated billing failures. Initiating automated RCA now.',
      );

      const run = await this.deps.commanderRunner.runForBillingScenario();

      if (run.incident) {
        await this.deps.incidentStore.attachSlackThread(run.incident.incidentId, {
          channelId: event.channel,
          threadTs: decision.threadTs,
        });
      }

      for (const entry of run.transcript) {
        await this.postThreadMessage(
          event.channel,
          decision.threadTs,
          renderSlackMessage(entry),
        );
      }

      return decision;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.recordError(error);

      try {
        await this.postThreadMessage(
          event.channel,
          decision.threadTs,
          `Automated RCA paused due to a provider error.\n${errorMessage}`,
        );
      } catch (fallbackError) {
        this.recordError(fallbackError);
      }

      return decision;
    } finally {
      this.activeThreads.delete(threadKey);
    }
  }
}
