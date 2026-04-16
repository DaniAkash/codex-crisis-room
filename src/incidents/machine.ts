import { assign, setup } from 'xstate';

import {
  appendReportNote,
  setFixMerged,
  setFixPr,
  setGithubEvidence,
  setHealthCheck,
  setNotifiedStakeholders,
  setOwner,
  setSentryEvidence,
  updateReportStatus,
} from '../reporting/report-state';
import type { IncidentStatus } from '../reporting/types';
import { makeTimelineEntry } from './timeline';
import type {
  IncidentMachineContext,
  IncidentMachineEvent,
} from './types';

const getNextStatusForEvent = (
  context: IncidentMachineContext,
  event: IncidentMachineEvent,
): IncidentStatus => {
  switch (event.type) {
    case 'REPORT_UPDATED':
      return context.report.currentStatus;
    case 'START_TRIAGE':
      return 'triage_started';
    case 'SENTRY_EVIDENCE_FOUND':
    case 'GITHUB_EVIDENCE_FOUND':
      return 'investigating';
    case 'STAKEHOLDERS_NOTIFIED':
      return 'stakeholders_notified';
    case 'FIX_PR_OPENED':
      return 'fix_pr_opened';
    case 'OWNER_ASSIGNED':
      return 'owner_assigned';
    case 'FIX_MERGED':
      return 'fix_merged';
    case 'START_MONITORING':
      return 'monitoring';
    case 'HEALTH_CHECK_CLEAN':
      return context.cleanHealthChecks + 1 >= context.requiredCleanHealthChecks
        ? 'stabilized'
        : 'monitoring';
    case 'HEALTH_CHECK_FAILED':
      return 'monitoring';
  }
};

const evolveReport = (
  context: IncidentMachineContext,
  event: IncidentMachineEvent,
) => {
  const status = getNextStatusForEvent(context, event);

  switch (event.type) {
    case 'REPORT_UPDATED':
      return appendReportNote(context.report, event.note);
    case 'START_TRIAGE':
      return updateReportStatus(context.report, status);
    case 'SENTRY_EVIDENCE_FOUND':
      return setSentryEvidence(
        context.report,
        event.signature,
        event.suspectedCause,
      );
    case 'GITHUB_EVIDENCE_FOUND':
      return setGithubEvidence(
        context.report,
        event.suspectPrs,
        event.relevantFiles,
      );
    case 'STAKEHOLDERS_NOTIFIED':
      return setNotifiedStakeholders(context.report, event.stakeholders);
    case 'FIX_PR_OPENED':
      return setFixPr(context.report, event.prNumber);
    case 'OWNER_ASSIGNED':
      return setOwner(context.report, event.owner);
    case 'FIX_MERGED':
      return setFixMerged(context.report, event.prNumber);
    case 'START_MONITORING':
      return updateReportStatus(context.report, status);
    case 'HEALTH_CHECK_CLEAN':
    case 'HEALTH_CHECK_FAILED':
      return setHealthCheck(
        context.report,
        {
          clean: event.type === 'HEALTH_CHECK_CLEAN',
          errorCount: event.errorCount,
          summary: event.summary,
        },
        status,
      );
  }
};

export const incidentMachine = setup({
  types: {
    context: {} as IncidentMachineContext,
    events: {} as IncidentMachineEvent,
    input: {} as IncidentMachineContext,
  },
  guards: {
    hasEnoughCleanHealthChecks: ({ context }) =>
      context.cleanHealthChecks + 1 >= context.requiredCleanHealthChecks,
  },
  actions: {
    applyEvent: assign(({ context, event }) => ({
      timeline: [...context.timeline, makeTimelineEntry(event, context)],
      report: evolveReport(context, event),
      cleanHealthChecks:
        event.type === 'HEALTH_CHECK_CLEAN'
          ? context.cleanHealthChecks + 1
          : event.type === 'HEALTH_CHECK_FAILED'
            ? 0
            : context.cleanHealthChecks,
      monitoringCheckIndex:
        event.type === 'HEALTH_CHECK_CLEAN' ||
        event.type === 'HEALTH_CHECK_FAILED'
          ? context.monitoringCheckIndex + 1
          : context.monitoringCheckIndex,
    })),
  },
}).createMachine({
  id: 'incident',
  initial: 'new',
  context: ({ input }) => input,
  states: {
    new: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        START_TRIAGE: { target: 'triage_started', actions: 'applyEvent' },
      },
    },
    triage_started: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        SENTRY_EVIDENCE_FOUND: {
          target: 'investigating',
          actions: 'applyEvent',
        },
      },
    },
    investigating: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        GITHUB_EVIDENCE_FOUND: { actions: 'applyEvent' },
        STAKEHOLDERS_NOTIFIED: {
          target: 'stakeholders_notified',
          actions: 'applyEvent',
        },
      },
    },
    stakeholders_notified: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        FIX_PR_OPENED: { target: 'fix_pr_opened', actions: 'applyEvent' },
      },
    },
    fix_pr_opened: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        OWNER_ASSIGNED: { target: 'owner_assigned', actions: 'applyEvent' },
      },
    },
    owner_assigned: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        FIX_MERGED: { target: 'fix_merged', actions: 'applyEvent' },
      },
    },
    fix_merged: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        START_MONITORING: { target: 'monitoring', actions: 'applyEvent' },
      },
    },
    monitoring: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
        HEALTH_CHECK_CLEAN: [
          {
            guard: 'hasEnoughCleanHealthChecks',
            target: 'stabilized',
            actions: 'applyEvent',
          },
          {
            actions: 'applyEvent',
          },
        ],
        HEALTH_CHECK_FAILED: {
          actions: 'applyEvent',
        },
      },
    },
    stabilized: {
      on: {
        REPORT_UPDATED: { actions: 'applyEvent' },
      },
      type: 'final',
    },
  },
});
