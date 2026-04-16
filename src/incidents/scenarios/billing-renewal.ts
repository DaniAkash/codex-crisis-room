import { billingScenarioSchema, type BillingScenario } from '../types';

export const billingRenewalScenario: BillingScenario = billingScenarioSchema.parse({
  id: 'billing-renewal',
  source: 'monitoring',
  severity: 'critical',
  affectedArea: 'subscription renewals',
  summary:
    'Repeated subscription renewal failures after a billing-related deploy',
  alerts: [
    {
      userId: '123231343',
      message: 'Billing monitor: subscription renewal failed',
    },
    {
      userId: '234234231',
      message: 'Billing monitor: subscription renewal failed',
    },
    {
      userId: '342433434',
      message: 'Billing monitor: subscription renewal failed',
    },
  ],
  sentryEvidence: {
    signature: 'StripeError: No such payment_method',
    firstSeenAt: '2026-04-16T09:58:00.000Z',
    eventCount: 37,
    deployId: 'prod-2026.04.16.3',
    suspectedCause:
      'Regression in fallback payment method lookup after recent billing deploy',
  },
  githubEvidence: {
    relevantFiles: [
      'apps/api/src/billing/renewSubscription.ts',
      'apps/api/src/lib/stripe/getDefaultPaymentMethod.ts',
      'apps/webhooks/src/handlers/customerUpdated.ts',
    ],
    suspectPrs: [
      'PR #184 Refactor default payment method lookup',
      'PR #181 Cleanup billing retry worker',
      'PR #176 Customer sync webhook changes',
    ],
  },
  stakeholders: ['@user1', '@user2', '@user3'],
  fix: {
    suspectPr: 'PR #184 Refactor default payment method lookup',
    fixPr: 'PR #188',
    title: 'Fix fallback payment method resolution for subscription renewals',
    resolutionSummary:
      'Restore null fallback behavior for payment method resolution during renewals',
  },
  monitoringChecks: [
    {
      clean: false,
      errorCount: 12,
      summary: 'Failures are still occurring immediately after deploy',
    },
    {
      clean: true,
      errorCount: 0,
      summary: 'No new matching Sentry events in the last 6 minutes',
    },
    {
      clean: true,
      errorCount: 0,
      summary: '30 minutes with no new recurring billing failures',
    },
  ],
  requiredCleanHealthChecks: 2,
});
