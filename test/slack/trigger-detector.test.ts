import { describe, expect, test } from 'bun:test';

import { SlackTriggerDetector } from '../../src/slack/trigger-detector';

const channel = 'C123';

describe('SlackTriggerDetector', () => {
  test('triggers after 3 consecutive billing alerts', () => {
    const detector = new SlackTriggerDetector(channel);

    expect(
      detector.evaluate({
        channel,
        ts: '1',
        text: 'Billing monitor: subscription renewal failed for user usr_1042',
        bot_id: 'BILLING',
      }),
    ).toEqual({ triggered: false, reason: 'insufficient-alerts' });

    expect(
      detector.evaluate({
        channel,
        ts: '2',
        text: 'StripeError: No such payment_method',
        bot_id: 'BILLING',
      }),
    ).toEqual({ triggered: false, reason: 'insufficient-alerts' });

    expect(
      detector.evaluate({
        channel,
        ts: '3',
        text: 'ALERT: subscription renewal failures exceeded threshold for 15m in prod.',
        bot_id: 'CRISISROOM',
      }),
    ).toEqual({
      triggered: true,
      reason: 'three-consecutive-alerts',
      threadTs: '3',
      sourceTs: '3',
    });
  });

  test('resets alert sequence on unrelated human message', () => {
    const detector = new SlackTriggerDetector(channel);

    detector.evaluate({
      channel,
      ts: '1',
      text: 'Billing monitor: subscription renewal failed for user usr_1042',
      bot_id: 'BILLING',
    });
    detector.evaluate({
      channel,
      ts: '2',
      text: 'looking into it',
      user: 'U1',
    });

    expect(
      detector.evaluate({
        channel,
        ts: '3',
        text: 'Billing monitor: subscription renewal failed for user usr_2088',
        bot_id: 'BILLING',
      }),
    ).toEqual({ triggered: false, reason: 'insufficient-alerts' });
  });

  test('supports manual kickoff via app mention', () => {
    const detector = new SlackTriggerDetector(channel);

    expect(
      detector.evaluate({
        channel,
        ts: '10',
        text: '<@A0ATNQKJPHP> start triage',
        user: 'U123',
      }),
    ).toEqual({
      triggered: true,
      reason: 'manual-kickoff',
      threadTs: '10',
      sourceTs: '10',
    });
  });
});
