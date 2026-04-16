import { afterEach, describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { ScenarioEngine } from '../../src/incidents/scenario-engine';
import { IncidentStore } from '../../src/incidents/store';

const filePath = join(process.cwd(), 'tmp-test-scenarios', 'incidents.json');

afterEach(async () => {
  await rm(join(process.cwd(), 'tmp-test-scenarios'), {
    recursive: true,
    force: true,
  });
});

describe('ScenarioEngine', () => {
  test('runs seeded billing scenario to stabilization', async () => {
    const store = new IncidentStore(filePath);
    const engine = new ScenarioEngine(store);

    const incident = await engine.startBillingRenewalIncident();
    await engine.startTriage(incident.incidentId);
    await engine.getSentryEvidence(incident.incidentId);
    await engine.getGithubEvidence(incident.incidentId);
    await engine.notifyStakeholders(incident.incidentId);
    await engine.openFixPr(incident.incidentId);
    await engine.assignOwner(incident.incidentId, '@user1');
    await engine.mergeFix(incident.incidentId);
    await engine.startMonitoring(incident.incidentId);
    await engine.checkHealth(incident.incidentId);
    await engine.checkHealth(incident.incidentId);
    const finalCheck = await engine.checkHealth(incident.incidentId);
    const finalIncident = await engine.getIncident(incident.incidentId);

    expect(finalCheck.status).toBe('stabilized');
    expect(finalIncident?.report.currentStatus).toBe('stabilized');
  });
});
