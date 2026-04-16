import { describe, expect, test } from 'bun:test';

import { buildTranscriptFromMilestones } from '../../src/demo/transcript';
import type { AgentMilestone } from '../../src/agent/milestones';

describe('buildTranscriptFromMilestones', () => {
  test('converts milestones into Crisis Bot transcript entries', () => {
    const milestones: AgentMilestone[] = [
      {
        id: 'm1',
        incidentId: 'INC-042',
        stepNumber: 0,
        kind: 'triage_started',
        timestamp: '2026-04-16T10:03:00.000Z',
        summary: 'Initiated automated triage for INC-042',
        detail: 'Creating incident timeline and beginning evidence collection.',
        payload: {},
      },
      {
        id: 'm2',
        incidentId: 'INC-042',
        stepNumber: 1,
        kind: 'stakeholders_notified',
        timestamp: '2026-04-16T10:06:00.000Z',
        summary: 'Notified 3 stakeholders',
        detail: '@user1, @user2, @user3',
        payload: {
          stakeholders: ['@user1', '@user2', '@user3'],
        },
      },
    ];

    const transcript = buildTranscriptFromMilestones(milestones);

    expect(transcript).toHaveLength(2);
    expect(transcript[0]).toMatchObject({
      incidentId: 'INC-042',
      speaker: 'Crisis Bot',
      category: 'triage_started',
      summary: 'Initiated automated triage for INC-042',
      body: 'Creating incident timeline and beginning evidence collection.',
      mentions: [],
    });
    expect(transcript[1]).toMatchObject({
      category: 'stakeholders_notified',
      mentions: ['@user1', '@user2', '@user3'],
      body: '@user1, @user2, @user3',
    });
  });
});
