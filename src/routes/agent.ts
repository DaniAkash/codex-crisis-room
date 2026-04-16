import type { Hono } from 'hono';

import type { CrisisAgentRunner } from '../agent/run-crisis-agent';

export const registerAgentRoutes = (
  app: Hono,
  commanderRunner: CrisisAgentRunner,
) => {
  app.post('/debug/agent/run/billing-renewal', async (c) => {
    const run = await commanderRunner.runForBillingScenario();
    return c.json(run, 201);
  });

  app.post('/debug/agent/run/:incidentId', async (c) => {
    const run = await commanderRunner.runForIncident(c.req.param('incidentId'));
    return c.json(run);
  });

  app.get('/agent/runs/:runId', (c) => {
    const run = commanderRunner.getRun(c.req.param('runId'));

    if (!run) {
      return c.json({ error: 'Agent run not found' }, 404);
    }

    return c.json({ run });
  });
};
