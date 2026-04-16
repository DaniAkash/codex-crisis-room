import type { Hono } from 'hono';

import type { ScenarioEngine } from '../incidents/scenario-engine';
import { renderIncidentReport } from '../reporting/render-report';

const parseJsonBody = async <T>(request: Request): Promise<Partial<T>> => {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
};

type AssignOwnerBody = {
  owner: string;
};

export const registerIncidentRoutes = (
  app: Hono,
  scenarioEngine: ScenarioEngine,
) => {
  app.post('/debug/incident/billing-renewal/start', async (c) => {
    const incident = await scenarioEngine.startBillingRenewalIncident();
    return c.json({ incident }, 201);
  });

  app.post('/debug/incidents/reset', async (c) => {
    await scenarioEngine.reset();
    return c.json({ reset: true });
  });

  app.get('/incidents', async (c) => {
    const incidents = await scenarioEngine.listIncidents();
    return c.json({ incidents });
  });

  app.get('/incidents/:id', async (c) => {
    const incident = await scenarioEngine.getIncident(c.req.param('id'));

    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }

    return c.json({ incident });
  });

  app.get('/incidents/:id/report', async (c) => {
    const report = await scenarioEngine.getReport(c.req.param('id'));

    if (!report) {
      return c.json({ error: 'Incident not found' }, 404);
    }

    return c.json({ report });
  });

  app.get('/incidents/:id/report/rendered', async (c) => {
    const incident = await scenarioEngine.getIncident(c.req.param('id'));

    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }

    return c.json({ renderedReport: renderIncidentReport(incident) });
  });

  app.post('/incidents/:id/actions/:actionName', async (c) => {
    const incidentId = c.req.param('id');
    const actionName = c.req.param('actionName');
    const body = await parseJsonBody<AssignOwnerBody>(c.req.raw);

    switch (actionName) {
      case 'start-triage':
        return c.json(await scenarioEngine.startTriage(incidentId));
      case 'get-sentry-evidence':
        return c.json(await scenarioEngine.getSentryEvidence(incidentId));
      case 'get-github-evidence':
        return c.json(await scenarioEngine.getGithubEvidence(incidentId));
      case 'notify-stakeholders':
        return c.json(await scenarioEngine.notifyStakeholders(incidentId));
      case 'open-fix-pr':
        return c.json(await scenarioEngine.openFixPr(incidentId));
      case 'assign-owner':
        if (!body.owner) {
          return c.json({ error: 'owner is required' }, 400);
        }

        return c.json(await scenarioEngine.assignOwner(incidentId, body.owner));
      case 'merge-fix':
        return c.json(await scenarioEngine.mergeFix(incidentId));
      case 'start-monitoring':
        return c.json(await scenarioEngine.startMonitoring(incidentId));
      case 'check-health':
        return c.json(await scenarioEngine.checkHealth(incidentId));
      default:
        return c.json({ error: `Unknown action ${actionName}` }, 404);
    }
  });
};
