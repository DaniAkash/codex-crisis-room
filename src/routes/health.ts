import type { Hono } from 'hono';

export const registerHealthRoute = (app: Hono) => {
  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'codex-crisis-room',
      timestamp: new Date().toISOString(),
    }),
  );
};
