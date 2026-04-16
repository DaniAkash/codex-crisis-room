import { Hono } from 'hono';

import { createIncidentServices } from './incidents/services';
import { registerAgentRoutes } from './routes/agent';
import { registerDebugRoute } from './routes/debug';
import { registerHealthRoute } from './routes/health';
import { registerIncidentRoutes } from './routes/incidents';
import { registerReadyRoute } from './routes/ready';

export const createApp = () => {
  const app = new Hono();
  const { scenarioEngine, commanderRunner, slackTransport } = createIncidentServices();

  registerHealthRoute(app);
  registerReadyRoute(app);
  registerDebugRoute(app, slackTransport);
  registerIncidentRoutes(app, scenarioEngine);
  registerAgentRoutes(app, commanderRunner);

  return {
    app,
    slackTransport,
  };
};
