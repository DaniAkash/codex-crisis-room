import type {
  HealthCheckSummary,
  IncidentReport,
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
} from './types';

type CreateInitialReportInput = {
  incidentId: string;
  summary: string;
  affectedArea: string;
  severity: IncidentSeverity;
  source: IncidentSource;
};

export const createInitialReport = ({
  incidentId,
  summary,
  affectedArea,
  severity,
  source,
}: CreateInitialReportInput): IncidentReport => ({
  incidentId,
  currentStatus: 'new',
  severity,
  source,
  summary,
  affectedArea,
  suspectedCause: null,
  sentrySignature: null,
  relevantFiles: [],
  relatedPrs: [],
  notifiedStakeholders: [],
  owner: null,
  fixPrNumber: null,
  resolutionNotes: [],
  lastHealthCheck: null,
});

export const updateReportStatus = (
  report: IncidentReport,
  status: IncidentStatus,
): IncidentReport => ({
  ...report,
  currentStatus: status,
});

export const setSentryEvidence = (
  report: IncidentReport,
  signature: string,
  suspectedCause: string,
): IncidentReport => ({
  ...report,
  currentStatus: 'investigating',
  sentrySignature: signature,
  suspectedCause,
});

export const setGithubEvidence = (
  report: IncidentReport,
  prs: string[],
  files: string[],
): IncidentReport => ({
  ...report,
  currentStatus: 'investigating',
  relatedPrs: Array.from(new Set([...report.relatedPrs, ...prs])),
  relevantFiles: Array.from(new Set([...report.relevantFiles, ...files])),
});

export const setNotifiedStakeholders = (
  report: IncidentReport,
  stakeholders: string[],
): IncidentReport => ({
  ...report,
  currentStatus: 'stakeholders_notified',
  notifiedStakeholders: Array.from(
    new Set([...report.notifiedStakeholders, ...stakeholders]),
  ),
});

export const setFixPr = (
  report: IncidentReport,
  prNumber: string,
): IncidentReport => ({
  ...report,
  currentStatus: 'fix_pr_opened',
  fixPrNumber: prNumber,
  relatedPrs: Array.from(new Set([...report.relatedPrs, prNumber])),
});

export const setOwner = (
  report: IncidentReport,
  owner: string,
): IncidentReport => ({
  ...report,
  currentStatus: 'owner_assigned',
  owner,
});

export const setFixMerged = (
  report: IncidentReport,
  prNumber: string,
): IncidentReport => ({
  ...report,
  currentStatus: 'fix_merged',
  resolutionNotes: Array.from(
    new Set([...report.resolutionNotes, `Fix merged in ${prNumber}`]),
  ),
});

export const setHealthCheck = (
  report: IncidentReport,
  healthCheck: HealthCheckSummary,
  nextStatus: IncidentStatus,
): IncidentReport => ({
  ...report,
  currentStatus: nextStatus,
  lastHealthCheck: healthCheck,
  resolutionNotes:
    nextStatus === 'stabilized'
      ? Array.from(
          new Set([
            ...report.resolutionNotes,
            'Incident stabilized after clean monitoring window',
          ]),
        )
      : report.resolutionNotes,
});
