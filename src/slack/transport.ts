import type { SocketModeClient } from '@slack/socket-mode';
import type { WebClient } from '@slack/web-api';

import type { CrisisAgentRunner } from '../agent/run-crisis-agent';
import { demoConfig } from '../demo/config';
import { buildSlackStory, type SlackStoryBeat } from '../demo/slack-story';
import type { IncidentStore } from '../incidents/store';
import { renderSlackBeat } from './render';
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

type PendingReview = {
  channel: string;
  threadTs: string;
  afterConfirmation: SlackStoryBeat[];
  allowedUserIds: Set<string>;
};

export class SlackTransport {
  private readonly triggerDetector: SlackTriggerDetector;
  private readonly activeThreads = new Set<string>();
  private readonly pendingReviews = new Map<string, PendingReview>();
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

  private async demoDelay(ms: number) {
    if (demoConfig.fastMode) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isHumanConfirmation(
    event: SlackMessageEvent,
    pendingReview: PendingReview,
  ) {
    if (event.bot_id || event.subtype || !event.user || !event.text) {
      return false;
    }

    if (
      pendingReview.allowedUserIds.size > 0 &&
      !pendingReview.allowedUserIds.has(event.user)
    ) {
      return false;
    }

    return /\b(lgtm|looks good|ok to merge|okay to merge|approved|ship it|works|go ahead)\b/i.test(
      event.text,
    );
  }

  private async postBeats(
    channel: string,
    threadTs: string,
    beats: SlackStoryBeat[],
  ) {
    for (const beat of beats) {
      await this.postThreadMessage(channel, threadTs, renderSlackBeat(beat));
      await this.demoDelay(beat.kind === 'codex_fix_invocation' ? 900 : 250);
    }
  }

  private async resumeAfterReview(event: SlackMessageEvent, threadKey: string) {
    const pendingReview = this.pendingReviews.get(threadKey);

    if (!pendingReview || !this.isHumanConfirmation(event, pendingReview)) {
      return false;
    }

    this.pendingReviews.delete(threadKey);
    this.activeThreads.add(threadKey);

    try {
      if (event.user) {
        await this.postThreadMessage(
          pendingReview.channel,
          pendingReview.threadTs,
          `Review confirmed by <@${event.user}>. Proceeding with merge and rollout.`,
        );
      }

      await this.postBeats(
        pendingReview.channel,
        pendingReview.threadTs,
        pendingReview.afterConfirmation,
      );
    } finally {
      this.activeThreads.delete(threadKey);
    }

    return true;
  }

  async handleMessage(event: SlackMessageEvent) {
    const threadKey = `${event.channel}:${event.thread_ts ?? event.ts}`;

    if (await this.resumeAfterReview(event, threadKey)) {
      return {
        triggered: false as const,
        reason: 'ignored' as const,
      };
    }

    const decision = this.triggerDetector.evaluate(event);

    if (!decision.triggered) {
      return decision;
    }

    const decisionThreadKey = `${event.channel}:${decision.threadTs}`;

    if (this.activeThreads.has(decisionThreadKey)) {
      return decision;
    }

    this.activeThreads.add(decisionThreadKey);

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

      const story = buildSlackStory(run.milestones, demoConfig);

      await this.postBeats(
        event.channel,
        decision.threadTs,
        story.beforeConfirmation,
      );

      if (story.afterConfirmation.length > 0) {
        this.pendingReviews.set(decisionThreadKey, {
          channel: event.channel,
          threadTs: decision.threadTs,
          afterConfirmation: story.afterConfirmation,
          allowedUserIds: new Set(
            [
              demoConfig.reviewerSlackId,
              demoConfig.ownerSlackId,
            ].filter((entry): entry is string => Boolean(entry)),
          ),
        });
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
      this.activeThreads.delete(decisionThreadKey);
    }
  }
}
