import type { Hono } from 'hono';

import { env } from '../config/env';
import type { SlackTransport } from '../slack/transport';

export const registerDebugRoute = (
  app: Hono,
  slackTransport?: SlackTransport | null,
) => {
  app.get('/debug', (c) =>
    c.json({
      service: 'codex-crisis-room',
      environment: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      slackConfigured:
        Boolean(env.SLACK_BOT_TOKEN) &&
        Boolean(env.SLACK_APP_TOKEN) &&
        Boolean(env.SLACK_INCIDENTS_CHANNEL_ID),
      features: {
        slackTransport: Boolean(slackTransport),
        incidents: true,
        toolLoopAgent: true,
      },
    }),
  );

  app.get('/debug/slack/status', (c) =>
    c.json({
      slackTransport: slackTransport?.getStatus() ?? {
        connected: false,
        initialized: false,
        workspaceName: env.SLACK_WORKSPACE_NAME ?? null,
        appId: env.SLACK_APP_ID ?? null,
        incidentsChannelId: env.SLACK_INCIDENTS_CHANNEL_ID ?? null,
        lastError: null,
      },
    }),
  );
};
