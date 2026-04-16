import { describe, expect, test } from 'bun:test';

import type { AgentMilestone } from '../../src/agent/milestones';
import { buildSlackStory } from '../../src/demo/slack-story';

describe('buildSlackStory', () => {
  test('groups milestones into polished Slack story beats with linked PRs', () => {
    const milestones: AgentMilestone[] = [
      {
        id: 'm1',
        incidentId: 'INC-011',
        stepNumber: 0,
        kind: 'incident_detected',
        timestamp: '2026-04-16T10:03:00.000Z',
        summary: 'Detected repeated billing failures across 3 user events',
        detail: null,
        payload: { alertCount: 3, repeated: true },
      },
      {
        id: 'm2',
        incidentId: 'INC-011',
        stepNumber: 1,
        kind: 'sentry_evidence_found',
        timestamp: '2026-04-16T10:04:00.000Z',
        summary: 'Sentry correlation found 37 events for StripeError: No such payment_method',
        detail: 'Regression in fallback payment method lookup after recent billing deploy',
        payload: {
          signature: 'StripeError: No such payment_method',
          deployId: 'prod-2026.04.16.3',
          eventCount: 37,
        },
      },
      {
        id: 'm3',
        incidentId: 'INC-011',
        stepNumber: 2,
        kind: 'github_evidence_found',
        timestamp: '2026-04-16T10:04:10.000Z',
        summary: 'GitHub evidence linked 3 suspect PRs and 3 relevant files',
        detail: null,
        payload: {
          relevantFiles: [
            'apps/api/src/billing/renewSubscription.ts',
            'apps/api/src/lib/stripe/getDefaultPaymentMethod.ts',
          ],
          suspectPrs: ['PR #184 Refactor default payment method lookup'],
        },
      },
      {
        id: 'm4',
        incidentId: 'INC-011',
        stepNumber: 3,
        kind: 'report_updated',
        timestamp: '2026-04-16T10:05:00.000Z',
        summary: 'Updated live incident report',
        detail: 'Report updated.',
        payload: { note: 'Report updated.' },
      },
      {
        id: 'm5',
        incidentId: 'INC-011',
        stepNumber: 4,
        kind: 'stakeholders_notified',
        timestamp: '2026-04-16T10:05:10.000Z',
        summary: 'Notified 3 stakeholders',
        detail: '@user1 @user2 @user3',
        payload: { stakeholders: ['@user1', '@user2', '@user3'] },
      },
      {
        id: 'm6',
        incidentId: 'INC-011',
        stepNumber: 5,
        kind: 'fix_pr_opened',
        timestamp: '2026-04-16T10:06:00.000Z',
        summary: 'Opened candidate fix PR PR #188',
        detail: 'Fix fallback payment method resolution for subscription renewals',
        payload: { prNumber: 'PR #188' },
      },
      {
        id: 'm7',
        incidentId: 'INC-011',
        stepNumber: 6,
        kind: 'owner_assigned',
        timestamp: '2026-04-16T10:07:00.000Z',
        summary: 'Incident assigned to @user1',
        detail: null,
        payload: { owner: '@user1' },
      },
      {
        id: 'm8',
        incidentId: 'INC-011',
        stepNumber: 7,
        kind: 'fix_merged',
        timestamp: '2026-04-16T10:08:00.000Z',
        summary: 'PR #188 merged and rolling out',
        detail: 'Restore null fallback behavior during renewals',
        payload: { prNumber: 'PR #188' },
      },
      {
        id: 'm9',
        incidentId: 'INC-011',
        stepNumber: 8,
        kind: 'monitoring_clean',
        timestamp: '2026-04-16T10:09:00.000Z',
        summary: 'Failures are still occurring immediately after deploy',
        detail: 'Failures are still occurring immediately after deploy',
        payload: { clean: false },
      },
      {
        id: 'm10',
        incidentId: 'INC-011',
        stepNumber: 9,
        kind: 'monitoring_clean',
        timestamp: '2026-04-16T10:15:00.000Z',
        summary: 'No new matching Sentry events in the last 6 minutes',
        detail: 'No new matching Sentry events in the last 6 minutes',
        payload: { clean: true },
      },
      {
        id: 'm11',
        incidentId: 'INC-011',
        stepNumber: 10,
        kind: 'incident_stabilized',
        timestamp: '2026-04-16T10:45:00.000Z',
        summary: 'Incident stabilized after clean monitoring window',
        detail: '30 minutes with no new recurring billing failures',
        payload: {},
      },
    ];

    const story = buildSlackStory(milestones, {
      githubRepo: 'DaniAkash/codex-crisis-room',
      reviewerSlackId: 'UREVIEWER',
      ownerSlackId: 'UOWNER',
      stakeholderSlackIds: ['U1', 'U2'],
      reportBaseUrl: 'https://demo.example.com',
      fastMode: true,
    });

    expect(story.beforeConfirmation.some((beat) => beat.kind === 'codex_fix_invocation')).toBe(true);
    expect(story.beforeConfirmation.some((beat) => beat.text.includes('<https://github.com/DaniAkash/codex-crisis-room/pull/184|PR #184>'))).toBe(true);
    expect(story.beforeConfirmation.some((beat) => beat.text.includes('<@UREVIEWER> please review the candidate fix'))).toBe(true);
    expect(story.afterConfirmation[0]?.text).toContain('<@UOWNER>');
    expect(story.afterConfirmation.at(-1)?.text).toContain('Final report: <https://demo.example.com/incidents/INC-011/report/rendered|rendered incident report>');
  });
});
