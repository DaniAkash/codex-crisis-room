import { afterEach, describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { ScenarioEngine } from '../../src/incidents/scenario-engine';
import { IncidentStore } from '../../src/incidents/store';
import { renderIncidentReport } from '../../src/reporting/render-report';

const filePath = join(process.cwd(), 'tmp-test-render-report', 'incidents.json');

afterEach(async () => {
  await rm(join(process.cwd(), 'tmp-test-render-report'), {
    recursive: true,
    force: true,
  });
});

describe('renderIncidentReport', () => {
  test('produces a demo-ready rendered report from completed incident state', async () => {
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
    await engine.checkHealth(incident.incidentId);

    const finalIncident = await engine.getIncident(incident.incidentId);

    if (!finalIncident) {
      throw new Error('Expected incident to exist');
    }

    const rendered = renderIncidentReport(finalIncident);

    expect(rendered.headline).toContain('INC-001');
    expect(rendered.statusLine).toContain('stabilized');
    expect(rendered.ownerLine).toContain('@user1');
    expect(rendered.rootCauseSummary).toContain('payment method');
    expect(rendered.evidenceSummary).toContain('Sentry signature');
    expect(rendered.suspectPrSummary).toContain('PR #184');
    expect(rendered.fixSummary).toContain('PR #188');
    expect(rendered.monitoringSummary).toContain('Clean monitoring check');
    expect(rendered.nextAction).toBe('Prepare final incident summary');
    expect(rendered.sections).toHaveLength(3);
  });
});
