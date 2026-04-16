import { Hono } from 'hono';

import { createIncidentServices } from './incidents/services';
import { registerDebugRoute } from './routes/debug';
import { registerHealthRoute } from './routes/health';
import { registerIncidentRoutes } from './routes/incidents';
import { registerReadyRoute } from './routes/ready';

export const createApp = () => {
  const app = new Hono();
  const { scenarioEngine } = createIncidentServices();

  registerHealthRoute(app);
  registerReadyRoute(app);
  registerDebugRoute(app);
  registerIncidentRoutes(app, scenarioEngine);

  return app;
};
