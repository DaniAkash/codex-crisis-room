import type {
  IncidentSummary,
  RepeatedIncidentDetection,
} from './types';
import { IncidentStore } from './store';

export class ScenarioEngine {
  constructor(private readonly store: IncidentStore) {}

  startBillingRenewalIncident() {
    return this.store.createIncidentFromScenario('billing-renewal');
  }

  async detectRepeatedIncident(
    incidentId: string,
  ): Promise<RepeatedIncidentDetection> {
    const incident = await this.store.getIncident(incidentId);

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const alertBurst = incident.timeline.find((entry) => entry.kind === 'ALERT_BURST');
    const alerts = Array.isArray(alertBurst?.metadata.alerts)
      ? alertBurst.metadata.alerts
      : [];

    return {
      repeated: alerts.length >= 3,
      alertCount: alerts.length,
      summary: `Detected repeated billing failures across ${alerts.length} user events`,
    };
  }

  async startTriage(incidentId: string) {
    return {
      incident: await this.store.send(incidentId, { type: 'START_TRIAGE' }),
      payload: { started: true },
    };
  }

  async getSentryEvidence(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const evidence = scenario.sentryEvidence;

    const incident = await this.store.send(incidentId, {
      type: 'SENTRY_EVIDENCE_FOUND',
      signature: evidence.signature,
      suspectedCause: evidence.suspectedCause,
      firstSeenAt: evidence.firstSeenAt,
      deployId: evidence.deployId,
      eventCount: evidence.eventCount,
    });

    return { incident, payload: evidence };
  }

  async getGithubEvidence(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const evidence = scenario.githubEvidence;

    const incident = await this.store.send(incidentId, {
      type: 'GITHUB_EVIDENCE_FOUND',
      suspectPrs: evidence.suspectPrs,
      relevantFiles: evidence.relevantFiles,
    });

    return { incident, payload: evidence };
  }

  async notifyStakeholders(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const incident = await this.store.send(incidentId, {
      type: 'STAKEHOLDERS_NOTIFIED',
      stakeholders: scenario.stakeholders,
    });

    return { incident, payload: scenario.stakeholders };
  }

  async openFixPr(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const incident = await this.store.send(incidentId, {
      type: 'FIX_PR_OPENED',
      prNumber: scenario.fix.fixPr,
      title: scenario.fix.title,
    });

    return { incident, payload: scenario.fix };
  }

  async assignOwner(incidentId: string, owner: string) {
    const incident = await this.store.send(incidentId, {
      type: 'OWNER_ASSIGNED',
      owner,
    });

    return { incident, payload: { owner } };
  }

  async mergeFix(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const incident = await this.store.send(incidentId, {
      type: 'FIX_MERGED',
      prNumber: scenario.fix.fixPr,
      resolutionSummary: scenario.fix.resolutionSummary,
    });

    return { incident, payload: scenario.fix };
  }

  async startMonitoring(incidentId: string) {
    const incident = await this.store.send(incidentId, {
      type: 'START_MONITORING',
    });

    return { incident, payload: { monitoring: true } };
  }

  async checkHealth(incidentId: string) {
    const incident = await this.store.getIncident(incidentId);

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const scenario = this.store.getScenarioOrThrow(incidentId);
    const checksCompleted = incident.timeline.filter((entry) =>
      ['HEALTH_CHECK_CLEAN', 'HEALTH_CHECK_FAILED'].includes(entry.kind),
    ).length;
    const fallbackCheck =
      scenario.monitoringChecks[scenario.monitoringChecks.length - 1];
    const currentCheck = scenario.monitoringChecks[checksCompleted] ?? fallbackCheck;

    if (!currentCheck) {
      throw new Error(
        `Scenario ${scenario.id} does not define monitoring checks`,
      );
    }

    const nextIncident = await this.store.send(incidentId, {
      type: currentCheck.clean ? 'HEALTH_CHECK_CLEAN' : 'HEALTH_CHECK_FAILED',
      errorCount: currentCheck.errorCount,
      summary: currentCheck.summary,
    });

    return { incident: nextIncident, payload: currentCheck };
  }

  async updateIncidentReport(incidentId: string, note: string) {
    const incident = await this.store.send(incidentId, {
      type: 'REPORT_UPDATED',
      note,
    });

    return {
      incident,
      payload: {
        note,
        report: incident.report,
      },
    };
  }

  async getIncidentState(incidentId: string) {
    const incident = await this.store.getIncident(incidentId);

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    return {
      incident,
      payload: {
        status: incident.status,
        report: incident.report,
        timeline: incident.timeline,
      },
    };
  }

  getIncident(incidentId: string): Promise<IncidentSummary | null> {
    return this.store.getIncident(incidentId);
  }

  listIncidents() {
    return this.store.listIncidents();
  }

  async getReport(incidentId: string) {
    const incident = await this.store.getIncident(incidentId);
    return incident?.report ?? null;
  }

  reset() {
    return this.store.reset();
  }
}
