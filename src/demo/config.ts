import { env } from '../config/env';

export type DemoConfig = {
  githubRepo: string | null;
  reviewerSlackId: string | null;
  ownerSlackId: string | null;
  stakeholderSlackIds: string[];
  reportBaseUrl: string | null;
  fastMode: boolean;
};

const splitCsv = (value?: string | null) =>
  value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];

export const demoConfig: DemoConfig = {
  githubRepo: env.DEMO_GITHUB_REPO ?? null,
  reviewerSlackId: env.DEMO_REVIEWER_SLACK_ID ?? null,
  ownerSlackId: env.DEMO_OWNER_SLACK_ID ?? null,
  stakeholderSlackIds: splitCsv(env.DEMO_STAKEHOLDER_SLACK_IDS),
  reportBaseUrl: env.DEMO_REPORT_BASE_URL ?? null,
  fastMode: env.FAST_DEMO_MODE !== 'false',
};

export const formatSlackMention = (slackId: string | null | undefined) =>
  slackId ? `<@${slackId}>` : null;

export const buildGithubPrUrl = (
  githubRepo: string | null,
  prReference: string | null | undefined,
) => {
  if (!githubRepo || !prReference) {
    return null;
  }

  const prNumberMatch = prReference.match(/#(\d+)/);

  if (!prNumberMatch) {
    return null;
  }

  return `https://github.com/${githubRepo}/pull/${prNumberMatch[1]}`;
};

export const buildRenderedReportUrl = (
  reportBaseUrl: string | null,
  incidentId: string,
) => {
  if (!reportBaseUrl) {
    return null;
  }

  return `${reportBaseUrl.replace(/\/$/, '')}/incidents/${incidentId}/report/rendered`;
};
