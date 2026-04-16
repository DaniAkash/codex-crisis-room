import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import { incidentMachine } from '../../src/incidents/machine';
import { createInitialReport } from '../../src/reporting/report-state';

const createTestActor = () => {
  const actor = createActor(incidentMachine, {
    input: {
      incidentId: 'INC-001',
      scenarioId: 'billing-renewal',
      report: createInitialReport({
        incidentId: 'INC-001',
        summary: 'Repeated subscription failures',
        affectedArea: 'subscription renewals',
        severity: 'critical',
        source: 'monitoring',
      }),
      timeline: [],
      cleanHealthChecks: 0,
      requiredCleanHealthChecks: 2,
      monitoringCheckIndex: 0,
    },
  });

  actor.start();
  return actor;
};

describe('incidentMachine', () => {
  test('progresses through valid transitions', () => {
    const actor = createTestActor();

    actor.send({ type: 'START_TRIAGE' });
    actor.send({
      type: 'SENTRY_EVIDENCE_FOUND',
      signature: 'StripeError: No such payment_method',
      suspectedCause: 'Regression in payment method fallback',
      firstSeenAt: '2026-04-16T09:58:00.000Z',
      deployId: 'prod-2026.04.16.3',
      eventCount: 37,
    });
    actor.send({
      type: 'STAKEHOLDERS_NOTIFIED',
      stakeholders: ['@user1', '@user2'],
    });
    actor.send({
      type: 'FIX_PR_OPENED',
      prNumber: 'PR #188',
      title: 'Fix billing fallback',
    });

    expect(actor.getSnapshot().value).toBe('fix_pr_opened');
    expect(actor.getSnapshot().context.timeline).toHaveLength(4);
  });

  test('ignores invalid transitions by machine design', () => {
    const actor = createTestActor();

    actor.send({
      type: 'FIX_MERGED',
      prNumber: 'PR #188',
      resolutionSummary: 'Merged too early',
    });

    expect(actor.getSnapshot().value).toBe('new');
    expect(actor.getSnapshot().context.timeline).toHaveLength(0);
  });

  test('stabilizes after enough clean health checks', () => {
    const actor = createTestActor();

    actor.send({ type: 'START_TRIAGE' });
    actor.send({
      type: 'SENTRY_EVIDENCE_FOUND',
      signature: 'StripeError: No such payment_method',
      suspectedCause: 'Regression in payment method fallback',
      firstSeenAt: '2026-04-16T09:58:00.000Z',
      deployId: 'prod-2026.04.16.3',
      eventCount: 37,
    });
    actor.send({
      type: 'STAKEHOLDERS_NOTIFIED',
      stakeholders: ['@user1'],
    });
    actor.send({
      type: 'FIX_PR_OPENED',
      prNumber: 'PR #188',
      title: 'Fix billing fallback',
    });
    actor.send({ type: 'OWNER_ASSIGNED', owner: '@user1' });
    actor.send({
      type: 'FIX_MERGED',
      prNumber: 'PR #188',
      resolutionSummary: 'Merged fix',
    });
    actor.send({ type: 'START_MONITORING' });
    actor.send({
      type: 'HEALTH_CHECK_CLEAN',
      errorCount: 0,
      summary: 'No new errors',
    });
    actor.send({
      type: 'HEALTH_CHECK_CLEAN',
      errorCount: 0,
      summary: '30 minutes clean',
    });

    expect(actor.getSnapshot().value).toBe('stabilized');
    expect(actor.getSnapshot().context.report.currentStatus).toBe('stabilized');
  });
});
