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
      incidentId,
      repeated: alerts.length >= 3,
      alertCount: alerts.length,
      summary: `Detected repeated billing failures across ${alerts.length} user events`,
    };
  }

  async startTriage(incidentId: string) {
    const incident = await this.store.send(incidentId, { type: 'START_TRIAGE' });

    return {
      incidentId,
      status: incident.status,
      started: true,
      summary: 'Automated triage started for subscription renewals',
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

    return {
      incidentId,
      status: incident.status,
      signature: evidence.signature,
      firstSeenAt: evidence.firstSeenAt,
      eventCount: evidence.eventCount,
      deployId: evidence.deployId,
      suspectedCause: evidence.suspectedCause,
    };
  }

  async getGithubEvidence(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const evidence = scenario.githubEvidence;

    const incident = await this.store.send(incidentId, {
      type: 'GITHUB_EVIDENCE_FOUND',
      suspectPrs: evidence.suspectPrs,
      relevantFiles: evidence.relevantFiles,
    });

    return {
      incidentId,
      status: incident.status,
      relevantFiles: evidence.relevantFiles,
      suspectPrs: evidence.suspectPrs,
    };
  }

  async notifyStakeholders(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const incident = await this.store.send(incidentId, {
      type: 'STAKEHOLDERS_NOTIFIED',
      stakeholders: scenario.stakeholders,
    });

    return {
      incidentId,
      status: incident.status,
      stakeholders: scenario.stakeholders,
      summary: `Stakeholders notified: ${scenario.stakeholders.join(', ')}`,
    };
  }

  async openFixPr(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const incident = await this.store.send(incidentId, {
      type: 'FIX_PR_OPENED',
      prNumber: scenario.fix.fixPr,
      title: scenario.fix.title,
    });

    return {
      incidentId,
      status: incident.status,
      prNumber: scenario.fix.fixPr,
      title: scenario.fix.title,
      resolutionSummary: scenario.fix.resolutionSummary,
    };
  }

  async assignOwner(incidentId: string, owner: string) {
    const incident = await this.store.send(incidentId, {
      type: 'OWNER_ASSIGNED',
      owner,
    });

    return {
      incidentId,
      status: incident.status,
      owner,
      summary: `Incident assigned to ${owner}`,
    };
  }

  async mergeFix(incidentId: string) {
    const scenario = this.store.getScenarioOrThrow(incidentId);
    const incident = await this.store.send(incidentId, {
      type: 'FIX_MERGED',
      prNumber: scenario.fix.fixPr,
      resolutionSummary: scenario.fix.resolutionSummary,
    });

    return {
      incidentId,
      status: incident.status,
      prNumber: scenario.fix.fixPr,
      resolutionSummary: scenario.fix.resolutionSummary,
      summary: 'Fix merged and rollout in progress',
    };
  }

  async startMonitoring(incidentId: string) {
    const incident = await this.store.send(incidentId, {
      type: 'START_MONITORING',
    });

    return {
      incidentId,
      status: incident.status,
      monitoring: true,
      summary: 'Monitoring started after fix merge',
    };
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

    return {
      incidentId,
      status: nextIncident.status,
      clean: currentCheck.clean,
      errorCount: currentCheck.errorCount,
      summary: currentCheck.summary,
    };
  }

  async updateIncidentReport(incidentId: string, note: string) {
    const incident = await this.store.send(incidentId, {
      type: 'REPORT_UPDATED',
      note,
    });

    return {
      incidentId,
      status: incident.status,
      noteRecorded: true,
      note,
    };
  }

  async getIncidentState(incidentId: string) {
    const incident = await this.store.getIncident(incidentId);

    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    return {
      incidentId: incident.incidentId,
      status: incident.status,
      suspectedCause: incident.report.suspectedCause,
      sentrySignature: incident.report.sentrySignature,
      relevantFiles: incident.report.relevantFiles,
      relatedPrs: incident.report.relatedPrs,
      notifiedStakeholders: incident.report.notifiedStakeholders,
      owner: incident.report.owner,
      fixPrNumber: incident.report.fixPrNumber,
      resolutionNotes: incident.report.resolutionNotes,
      lastHealthCheck: incident.report.lastHealthCheck,
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
