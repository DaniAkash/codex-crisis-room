export type SlackMessageEvent = {
  channel: string;
  ts: string;
  thread_ts?: string;
  text?: string;
  bot_id?: string;
  subtype?: string;
  user?: string;
};

export type SlackTriggerDecision =
  | {
      triggered: false;
      reason: 'wrong-channel' | 'not-alert' | 'insufficient-alerts' | 'ignored';
    }
  | {
      triggered: true;
      reason: 'three-consecutive-alerts' | 'manual-kickoff';
      threadTs: string;
      sourceTs: string;
    };

export type SlackStatus = {
  connected: boolean;
  initialized: boolean;
  workspaceName: string | null;
  appId: string | null;
  incidentsChannelId: string | null;
  lastError: string | null;
};
