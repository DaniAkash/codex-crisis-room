import { Hono } from 'hono';

import { registerDebugRoute } from './routes/debug';
import { registerHealthRoute } from './routes/health';
import { registerReadyRoute } from './routes/ready';

export const createApp = () => {
  const app = new Hono();

  registerHealthRoute(app);
  registerReadyRoute(app);
  registerDebugRoute(app);

  return app;
};
