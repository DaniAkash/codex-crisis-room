import type { Hono } from 'hono';

import { env } from '../config/env';

export const registerReadyRoute = (app: Hono) => {
  app.get('/ready', (c) =>
    c.json({
      status: 'ready',
      service: 'codex-crisis-room',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }),
  );
};
