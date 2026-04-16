import type { SlackMessageEvent, SlackTriggerDecision } from './types';

const billingAlertPattern =
  /(subscription renewal failed|subscription renewal failures exceeded threshold|StripeError: No such payment_method)/i;

const manualKickoffPattern = /\b(start triage|investigate|start)\b/i;

export class SlackTriggerDetector {
  private readonly recentAlerts = new Map<string, SlackMessageEvent[]>();

  constructor(private readonly incidentsChannelId: string) {}

  evaluate(event: SlackMessageEvent): SlackTriggerDecision {
    if (event.channel !== this.incidentsChannelId) {
      return { triggered: false, reason: 'wrong-channel' };
    }

    if (this.isManualKickoff(event)) {
      return {
        triggered: true,
        reason: 'manual-kickoff',
        threadTs: event.thread_ts ?? event.ts,
        sourceTs: event.ts,
      };
    }

    if (!this.isAlert(event)) {
      this.recentAlerts.delete(event.channel);
      return { triggered: false, reason: 'not-alert' };
    }

    const existing = this.recentAlerts.get(event.channel) ?? [];
    const next = [...existing, event].slice(-3);
    this.recentAlerts.set(event.channel, next);

    if (next.length < 3) {
      return { triggered: false, reason: 'insufficient-alerts' };
    }

    return {
      triggered: true,
      reason: 'three-consecutive-alerts',
      threadTs: event.thread_ts ?? event.ts,
      sourceTs: event.ts,
    };
  }

  private isAlert(event: SlackMessageEvent) {
    return Boolean(event.bot_id) && billingAlertPattern.test(event.text ?? '');
  }

  private isManualKickoff(event: SlackMessageEvent) {
    if (!event.text) {
      return false;
    }

    return (
      !event.bot_id &&
      /<@[^>]+>/.test(event.text) &&
      manualKickoffPattern.test(event.text)
    );
  }
}
