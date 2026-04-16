import type { Hono } from 'hono';

import { env } from '../config/env';

export const registerDebugRoute = (app: Hono) => {
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
        slackTransport: false,
        incidents: false,
        toolLoopAgent: false,
      },
    }),
  );
};
