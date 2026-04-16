import { createActor, type Actor, type Snapshot } from 'xstate';

import { createInitialReport } from '../reporting/report-state';
import type { IncidentStatus, SlackThreadRef } from '../reporting/types';
import { incidentMachine } from './machine';
import {
  loadPersistedStore,
  writeStoreAtomically,
} from './persistence';
import type { PersistedIncident } from './persistence-types';
import { billingRenewalScenario } from './scenarios/billing-renewal';
import { makeAlertBurstEntry } from './timeline';
import type {
  BillingScenario,
  Incident,
  IncidentMachineEvent,
} from './types';

type IncidentActor = Actor<typeof incidentMachine>;

type StoredIncident = {
  scenario: BillingScenario;
  actor: IncidentActor;
  slackThreadRef?: SlackThreadRef;
};

const scenarioRegistry: Record<string, BillingScenario> = {
  [billingRenewalScenario.id]: billingRenewalScenario,
};

export class IncidentStore {
  private readonly incidents = new Map<string, StoredIncident>();
  private nextIncidentNumber = 1;
  private loadPromise: Promise<void> | null = null;

  constructor(private readonly filePath: string) {}

  async createIncidentFromScenario(scenarioId: BillingScenario['id']) {
    await this.ensureLoaded();

    const scenario = this.getScenarioOrThrow(scenarioId);
    const incidentId = `INC-${String(this.nextIncidentNumber).padStart(3, '0')}`;
    const report = createInitialReport({
      incidentId,
      summary: scenario.summary,
      affectedArea: scenario.affectedArea,
      severity: scenario.severity,
      source: scenario.source,
    });

    const actor = createActor(incidentMachine, {
      input: {
        incidentId,
        scenarioId,
        report,
        timeline: [makeAlertBurstEntry(scenario.alerts)],
        cleanHealthChecks: 0,
        requiredCleanHealthChecks: scenario.requiredCleanHealthChecks,
        monitoringCheckIndex: 0,
      },
    });

    actor.start();
    this.incidents.set(incidentId, { scenario, actor });
    this.nextIncidentNumber += 1;
    await this.persist();

    return this.getIncidentOrThrow(incidentId);
  }

  async listIncidents() {
    await this.ensureLoaded();
    return Array.from(this.incidents.keys()).map((incidentId) =>
      this.getIncidentOrThrow(incidentId),
    );
  }

  async getIncident(incidentId: string): Promise<Incident | null> {
    await this.ensureLoaded();
    return this.incidents.has(incidentId)
      ? this.getIncidentOrThrow(incidentId)
      : null;
  }

  getIncidentOrThrow(incidentId: string): Incident {
    const stored = this.incidents.get(incidentId);

    if (!stored) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    return this.materializeIncident(incidentId, stored);
  }

  getScenarioOrThrow(incidentIdOrScenarioId: string): BillingScenario {
    const scenario =
      scenarioRegistry[incidentIdOrScenarioId] ??
      this.incidents.get(incidentIdOrScenarioId)?.scenario;

    if (!scenario) {
      throw new Error(`Scenario ${incidentIdOrScenarioId} not found`);
    }

    return scenario;
  }

  async send(incidentId: string, event: IncidentMachineEvent) {
    await this.ensureLoaded();
    const stored = this.incidents.get(incidentId);

    if (!stored) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    stored.actor.send(event);
    await this.persist();

    return this.materializeIncident(incidentId, stored);
  }

  async attachSlackThread(incidentId: string, slackThreadRef: SlackThreadRef) {
    await this.ensureLoaded();
    const stored = this.incidents.get(incidentId);

    if (!stored) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    stored.slackThreadRef = slackThreadRef;
    await this.persist();

    return this.materializeIncident(incidentId, stored);
  }

  async reset() {
    this.incidents.clear();
    this.nextIncidentNumber = 1;
    await this.persist();
  }

  private async ensureLoaded() {
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromDisk();
    }

    await this.loadPromise;
  }

  private async loadFromDisk() {
    const persisted = await loadPersistedStore(this.filePath);

    this.incidents.clear();
    this.nextIncidentNumber = persisted.nextIncidentNumber;

    for (const incident of persisted.incidents) {
      const scenario = this.getScenarioOrThrow(incident.scenarioId);
      this.incidents.set(incident.incidentId, {
        scenario,
        actor: this.restoreActor(incident, scenario),
        slackThreadRef: incident.slackThreadRef,
      });
    }
  }

  private restoreActor(
    incident: PersistedIncident,
    scenario: BillingScenario,
  ) {
    const actor = createActor(incidentMachine, {
      input: {
        incidentId: incident.incidentId,
        scenarioId: incident.scenarioId,
        report: incident.report,
        timeline: incident.timeline,
        cleanHealthChecks: 0,
        requiredCleanHealthChecks: scenario.requiredCleanHealthChecks,
        monitoringCheckIndex: 0,
      },
      snapshot: incident.machineSnapshot as Snapshot<unknown>,
    });
    actor.start();
    return actor;
  }

  private materializeIncident(
    incidentId: string,
    stored: StoredIncident,
  ): Incident {
    const snapshot = stored.actor.getSnapshot();
    const status = String(snapshot.value) as IncidentStatus;

    return {
      incidentId,
      scenarioId: stored.scenario.id,
      status,
      report: snapshot.context.report,
      timeline: snapshot.context.timeline,
      slackThreadRef: stored.slackThreadRef,
    };
  }

  private serializeIncident(
    incidentId: string,
    stored: StoredIncident,
  ): PersistedIncident {
    const snapshot = stored.actor.getSnapshot();
    const status = String(snapshot.value) as IncidentStatus;

    return {
      incidentId,
      scenarioId: stored.scenario.id,
      status,
      report: snapshot.context.report,
      timeline: snapshot.context.timeline,
      slackThreadRef: stored.slackThreadRef,
      machineSnapshot: stored.actor.getPersistedSnapshot(),
    };
  }

  private async persist() {
    await writeStoreAtomically(this.filePath, {
      incidents: Array.from(this.incidents.entries()).map(([incidentId, stored]) =>
        this.serializeIncident(incidentId, stored),
      ),
      nextIncidentNumber: this.nextIncidentNumber,
    });
  }
}
