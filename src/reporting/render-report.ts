import type { Incident } from '../incidents/types';
import type { IncidentReport } from './types';

export type RenderedIncidentReport = {
  incidentId: string;
  headline: string;
  statusLine: string;
  ownerLine: string;
  rootCauseSummary: string;
  evidenceSummary: string;
  suspectPrSummary: string;
  fixSummary: string;
  monitoringSummary: string;
  nextAction: string;
  reportCard: {
    severity: string;
    affectedArea: string;
    currentStatus: string;
    owner: string | null;
  };
  sections: Array<{
    title: string;
    lines: string[];
  }>;
};

const statusLineFor = (report: IncidentReport) =>
  `Status: ${report.currentStatus} | Severity: ${report.severity} | Area: ${report.affectedArea}`;

const ownerLineFor = (report: IncidentReport) =>
  report.owner ? `Owner: ${report.owner}` : 'Owner: unassigned';

const rootCauseSummaryFor = (report: IncidentReport) =>
  report.suspectedCause ?? 'Root cause still under investigation';

const evidenceSummaryFor = (report: IncidentReport) => {
  const parts = [
    report.sentrySignature ? `Sentry signature: ${report.sentrySignature}` : null,
    report.relevantFiles.length > 0
      ? `Relevant files: ${report.relevantFiles.join(', ')}`
      : null,
  ].filter((value): value is string => value !== null);

  return parts.join(' | ') || 'No evidence summary available yet';
};

const suspectPrSummaryFor = (report: IncidentReport) =>
  report.relatedPrs.length > 0
    ? `Related PRs: ${report.relatedPrs.join(', ')}`
    : 'No related PRs recorded yet';

const fixSummaryFor = (report: IncidentReport) =>
  report.fixPrNumber
    ? `Candidate fix PR: ${report.fixPrNumber}`
    : 'No fix PR opened yet';

const monitoringSummaryFor = (report: IncidentReport) =>
  report.lastHealthCheck
    ? `${report.lastHealthCheck.clean ? 'Clean' : 'Failing'} monitoring check: ${report.lastHealthCheck.summary}`
    : 'Monitoring has not started yet';

const nextActionFor = (report: IncidentReport) => {
  switch (report.currentStatus) {
    case 'new':
      return 'Begin triage';
    case 'triage_started':
      return 'Collect Sentry evidence';
    case 'investigating':
      return 'Correlate GitHub changes and notify stakeholders';
    case 'stakeholders_notified':
      return 'Open candidate fix PR';
    case 'fix_pr_opened':
      return 'Assign owner and validate fix';
    case 'owner_assigned':
      return 'Merge fix and prepare monitoring';
    case 'fix_merged':
      return 'Start monitoring production';
    case 'monitoring':
      return 'Continue clean monitoring checks';
    case 'stabilized':
      return 'Prepare final incident summary';
  }
};

export const renderIncidentReport = (
  incident: Incident,
): RenderedIncidentReport => {
  const report = incident.report;

  return {
    incidentId: incident.incidentId,
    headline: `Incident ${incident.incidentId}: ${report.summary}`,
    statusLine: statusLineFor(report),
    ownerLine: ownerLineFor(report),
    rootCauseSummary: rootCauseSummaryFor(report),
    evidenceSummary: evidenceSummaryFor(report),
    suspectPrSummary: suspectPrSummaryFor(report),
    fixSummary: fixSummaryFor(report),
    monitoringSummary: monitoringSummaryFor(report),
    nextAction: nextActionFor(report),
    reportCard: {
      severity: report.severity,
      affectedArea: report.affectedArea,
      currentStatus: report.currentStatus,
      owner: report.owner,
    },
    sections: [
      {
        title: 'Evidence',
        lines: [
          evidenceSummaryFor(report),
          suspectPrSummaryFor(report),
        ],
      },
      {
        title: 'Coordination',
        lines: [
          ownerLineFor(report),
          report.notifiedStakeholders.length > 0
            ? `Stakeholders: ${report.notifiedStakeholders.join(', ')}`
            : 'Stakeholders: none notified yet',
        ],
      },
      {
        title: 'Resolution',
        lines: [
          fixSummaryFor(report),
          monitoringSummaryFor(report),
          ...report.resolutionNotes,
        ],
      },
    ],
  };
};
