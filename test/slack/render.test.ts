import { describe, expect, test } from 'bun:test';

import { renderSlackMessage } from '../../src/slack/render';

describe('renderSlackMessage', () => {
  test('renders summary, body, and mentions into plain Slack text', () => {
    const output = renderSlackMessage({
      id: 't1',
      incidentId: 'INC-001',
      speaker: 'Crisis Bot',
      category: 'stakeholders_notified',
      summary: 'Notified 3 stakeholders',
      body: '@user1, @user2, @user3',
      mentions: ['@user1', '@user2', '@user3'],
      timestamp: '2026-04-16T10:06:00.000Z',
    });

    expect(output).toBe(
      'Notified 3 stakeholders\n@user1, @user2, @user3\n@user1 @user2 @user3',
    );
  });
});
