import type { AgentMilestone } from '../agent/milestones';
import {
  buildGithubPrUrl,
  buildRenderedReportUrl,
  formatSlackMention,
  type DemoConfig,
} from './config';

export type SlackStoryBeatKind =
  | 'incident_start'
  | 'triage_update'
  | 'investigation_update'
  | 'coordination_update'
  | 'codex_fix_invocation'
  | 'fix_update'
  | 'review_requested'
  | 'owner_assignment'
  | 'merge_update'
  | 'monitoring_update'
  | 'incident_close';

export type SlackStoryBeat = {
  id: string;
  kind: SlackStoryBeatKind;
  text: string;
};

export type SlackStory = {
  beforeConfirmation: SlackStoryBeat[];
  afterConfirmation: SlackStoryBeat[];
};

const findMilestone = (
  milestones: AgentMilestone[],
  kind: AgentMilestone['kind'],
) => milestones.find((milestone) => milestone.kind === kind) ?? null;

const filterMilestones = (
  milestones: AgentMilestone[],
  kind: AgentMilestone['kind'],
) => milestones.filter((milestone) => milestone.kind === kind);

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const buildPrLink = (
  demoConfig: DemoConfig,
  prReference: string | null | undefined,
) => {
  if (!prReference) {
    return null;
  }

  const url = buildGithubPrUrl(demoConfig.githubRepo, prReference);

  if (!url) {
    return prReference;
  }

  const prNumberMatch = prReference.match(/#(\d+)/);
  const label = prNumberMatch ? `PR #${prNumberMatch[1]}` : prReference;

  return `<${url}|${label}>`;
};

const renderFileList = (files: string[]) =>
  files.slice(0, 3).map((file) => `\`${file}\``).join(', ');

const mentionList = (mentions: string[]) => mentions.join(' ');

export const buildSlackStory = (
  milestones: AgentMilestone[],
  demoConfig: DemoConfig,
): SlackStory => {
  if (milestones.length === 0) {
    return {
      beforeConfirmation: [],
      afterConfirmation: [],
    };
  }

  const incidentId = milestones[0]!.incidentId;
  const incidentDetected = findMilestone(milestones, 'incident_detected');
  const sentryEvidence = findMilestone(milestones, 'sentry_evidence_found');
  const githubEvidence = findMilestone(milestones, 'github_evidence_found');
  const reportUpdated = findMilestone(milestones, 'report_updated');
  const stakeholdersNotified = findMilestone(milestones, 'stakeholders_notified');
  const fixPrOpened = findMilestone(milestones, 'fix_pr_opened');
  const ownerAssigned = findMilestone(milestones, 'owner_assigned');
  const fixMerged = findMilestone(milestones, 'fix_merged');
  const monitoringMilestones = filterMilestones(milestones, 'monitoring_clean');
  const incidentStabilized = findMilestone(milestones, 'incident_stabilized');
  const reportUrl = buildRenderedReportUrl(demoConfig.reportBaseUrl, incidentId);

  const alertCount =
    typeof incidentDetected?.payload.alertCount === 'number'
      ? incidentDetected.payload.alertCount
      : 0;
  const signature =
    typeof sentryEvidence?.payload.signature === 'string'
      ? sentryEvidence.payload.signature
      : 'StripeError: No such payment_method';
  const eventCount =
    typeof sentryEvidence?.payload.eventCount === 'number'
      ? sentryEvidence.payload.eventCount
      : 0;
  const deployId =
    typeof sentryEvidence?.payload.deployId === 'string'
      ? sentryEvidence.payload.deployId
      : 'prod-2026.04.16.3';
  const suspectedCause =
    typeof sentryEvidence?.detail === 'string'
      ? sentryEvidence.detail
      : 'Regression in fallback payment method lookup after recent billing deploy';
  const relevantFiles = asStringArray(githubEvidence?.payload.relevantFiles);
  const suspectPrs = asStringArray(githubEvidence?.payload.suspectPrs);
  const primarySuspectPr = suspectPrs[0] ?? null;
  const primarySuspectPrLink = buildPrLink(demoConfig, primarySuspectPr);
  const fixPrReference =
    typeof fixPrOpened?.payload.prNumber === 'string'
      ? fixPrOpened.payload.prNumber
      : null;
  const fixPrLink = buildPrLink(demoConfig, fixPrReference);
  const stakeholderMentions =
    demoConfig.stakeholderSlackIds.length > 0
      ? demoConfig.stakeholderSlackIds
          .map((slackId) => formatSlackMention(slackId))
          .filter((entry): entry is string => entry !== null)
      : asStringArray(stakeholdersNotified?.payload.stakeholders);
  const reviewerMention = formatSlackMention(demoConfig.reviewerSlackId);
  const ownerMention =
    formatSlackMention(demoConfig.ownerSlackId) ??
    (typeof ownerAssigned?.payload.owner === 'string'
      ? ownerAssigned.payload.owner
      : null);
  const residualMonitoring = monitoringMilestones[0];
  const cleanMonitoring = monitoringMilestones[1];

  const beforeConfirmation: SlackStoryBeat[] = [
    {
      id: crypto.randomUUID(),
      kind: 'incident_start',
      text: [
        `Detected repeated billing failures across ${alertCount} user events.`,
        `Initiating automated RCA for \`${incidentId}\` now.`,
      ].join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'triage_update',
      text: [
        'Current hypothesis:',
        '- shared billing-path regression after the latest deploy',
        '- correlating Sentry and recent billing changes now',
      ].join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'investigation_update',
      text: [
        'Investigation update:',
        `- Sentry found ${eventCount} matching events for \`${signature}\` after deploy \`${deployId}\``,
        `- Most likely regression path: ${suspectedCause}`,
        primarySuspectPrLink
          ? `- Primary suspect: ${primarySuspectPrLink}`
          : null,
        relevantFiles.length > 0
          ? `- Relevant files: ${renderFileList(relevantFiles)}`
          : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'coordination_update',
      text: [
        'Incident report updated and stakeholders notified.',
        reportUrl ? `Report: <${reportUrl}|rendered incident report>` : null,
        stakeholderMentions.length > 0
          ? `Paging: ${mentionList(stakeholderMentions)}`
          : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'codex_fix_invocation',
      text:
        'Invoking Codex to start the fix based on the suspected billing regression path.',
    },
    {
      id: crypto.randomUUID(),
      kind: 'fix_update',
      text: [
        fixPrLink
          ? `Opened candidate fix ${fixPrLink}.`
          : 'Opened candidate fix PR.',
        typeof fixPrOpened?.detail === 'string' ? fixPrOpened.detail : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'review_requested',
      text: reviewerMention
        ? `${reviewerMention} please review the candidate fix and confirm when it is okay to merge.`
        : 'Waiting for human reviewer confirmation before merge.',
    },
  ];

  const afterConfirmation: SlackStoryBeat[] = [
    {
      id: crypto.randomUUID(),
      kind: 'owner_assignment',
      text: ownerMention
        ? `Incident assigned to ${ownerMention}.`
        : 'Incident owner assigned.',
    },
    {
      id: crypto.randomUUID(),
      kind: 'merge_update',
      text: [
        fixPrLink
          ? `${fixPrLink} merged and rolling out now.`
          : 'Candidate fix merged and rolling out now.',
        typeof fixMerged?.detail === 'string' ? fixMerged.detail : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'monitoring_update',
      text: [
        'Monitoring update:',
        residualMonitoring?.detail ??
          'Residual failures are still clearing from retries already in flight.',
      ].join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'monitoring_update',
      text: [
        'Monitoring update:',
        cleanMonitoring?.detail ??
          'No new matching Sentry events in the last 6 minutes.',
      ].join('\n'),
    },
    {
      id: crypto.randomUUID(),
      kind: 'incident_close',
      text: [
        'Incident stabilized after clean monitoring window.',
        incidentStabilized?.detail ??
          '30 minutes with no new recurring billing failures.',
        reportUrl ? `Final report: <${reportUrl}|rendered incident report>` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    },
  ];

  if (!reportUpdated) {
    beforeConfirmation.splice(3, 1);
  }

  return {
    beforeConfirmation,
    afterConfirmation,
  };
};
