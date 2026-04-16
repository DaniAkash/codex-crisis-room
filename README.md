# Codex Crisis Room

Codex Crisis Room is a real incident-response agent running against a simulated production environment. The integrations are mocked for the hackathon, but the crisis-management logic is real and portable.

## What It Is

This project is an AI incident commander for software outages.

The agent receives a production signal, investigates the problem across tools, updates an incident report, identifies the likely root cause, coordinates stakeholders, proposes a fix path, and monitors production until the incident stabilizes.

For the hackathon build, the external systems are simulated:
- Sentry
- GitHub
- incident report storage
- stakeholder notifications
- production health checks

The important part is real:
- the agent runner
- the tool loop
- the reasoning and state transitions
- the incident progression logic
- the human handoff flow

## Core Product Principle

The demo should be honest about what is real versus mocked.

- Real: incident-response logic, orchestration, tool use, report generation, ownership assignment, and stabilization monitoring.
- Mocked: the production environment and third-party integrations.

That keeps the hackathon demo deterministic while preserving the real product core. The mocked tools can later be replaced with real integrations without changing the agent architecture.

## Demo Story

The preferred demo is a Slack-first incident narrative.

The video starts inside `#incidents`. A billing issue begins unfolding in real time:

1. Automated alerts report repeated subscription renewal failures.
2. Crisis Bot starts triage without waiting for a human command.
3. The bot checks mocked Sentry evidence and detects a repeated error signature.
4. The bot checks mocked GitHub history and finds likely related files and recent PRs.
5. The bot updates the incident report as it learns more.
6. The bot notifies stakeholders and opens a candidate fix PR.
7. A human reviewer confirms the likely offending PR and merges the fix.
8. The bot monitors production and reports that the incident has stabilized.

The final state is a complete incident artifact with:
- root cause summary
- timeline
- suspect and fix PRs
- affected files
- owner assignment
- recovery status

## Example Slack Flow

```text
Automated Report Bot
Billing monitor: subscription renewal failed for user `123231343`

Automated Report Bot
Billing monitor: subscription renewal failed for user `234234231`

Automated Report Bot
Billing monitor: subscription renewal failed for user `342433434`

Crisis Bot
Detected repeated billing failures across multiple users.
Initiating automated triage and creating incident `INC-042`.

Crisis Bot
Reading Sentry issues for repeated error trails tied to `subscription_renewal`.

Crisis Bot
Found a repeated failure signature and linked it to a recent deploy.

Crisis Bot
Checking recent merged GitHub changes touching billing flows.

Crisis Bot
Likely relevant files:
- `apps/api/src/billing/renewSubscription.ts`
- `apps/api/src/lib/stripe/getDefaultPaymentMethod.ts`
- `apps/webhooks/src/handlers/customerUpdated.ts`

Crisis Bot
Most relevant recent changes:
- `PR #184` Refactor default payment method lookup
- `PR #181` Cleanup billing retry worker
- `PR #176` Customer sync webhook changes

Crisis Bot
Updating incident report and notifying stakeholders.

Crisis Bot
Opened `PR #188`:
`Fix fallback payment method resolution for subscription renewals`

user1
Reviewing the incident report now. This does look like it came from `PR #184`.

user1
Confirmed. `PR #188` fixes the null payment method fallback. Merging now.

Crisis Bot
`PR #188` merged. Monitoring production for recurring billing failures.

Crisis Bot
30 minutes with no new incidents. Marking `INC-042` as stabilized.
```

## Architecture

The project has two main layers.

### 1. Agent Runner / Tool Loop

This is the real product core.

Responsibilities:
- receive the incident trigger
- decide which tool to call next
- collect evidence
- update the incident report
- identify the likely root cause
- notify stakeholders
- open or propose a fix path
- assign ownership when a human engages
- monitor for stabilization before closing the incident

### 2. Mocked-but-Stateful Environment Tools

These tools simulate the external systems the agent thinks it is operating against.

Planned tools:
- `search_sentry_errors`
- `get_recent_github_changes`
- `update_incident_report`
- `notify_stakeholders`
- `open_fix_pr`
- `check_prod_health`

The tools should not behave like static canned responses. They should reflect evolving incident state so the agent feels like it is operating inside a live environment.

Example:
- before the fix is merged, production health checks keep showing failures
- after the fix is merged, health improves
- after enough clean checks, the incident stabilizes

## Why This Is A Good Hackathon Shape

- It shows Codex acting, not just chatting.
- It is easy to understand in under a minute.
- It has visible movement across multiple systems.
- It is technically serious without requiring fragile live integrations.
- It leaves room for a strong future roadmap: swap mock tools for real ones.

## MVP Scope

The MVP should prove four things:

1. A real agent can drive the incident loop.
2. Tool outputs can evolve based on incident state.
3. The system can produce a useful incident report artifact.
4. A human can step in at the end to validate and merge the fix.

### Must Have

- agent runner with tool-calling loop
- one seeded incident scenario
- mocked Sentry and GitHub tools
- incident report artifact that updates over time
- Slack-like incident feed UI or replay
- fake or simulated fix PR creation
- post-fix monitoring state

### Nice To Have

- multiple incident scenarios
- richer PR diff summaries
- better incident report formatting
- multiple agent roles behind the scenes
- timeline playback controls for the demo

### Not Required For The Hackathon

- real Slack integration
- real Sentry integration
- real GitHub write access in the product flow
- real deploy or rollback infrastructure
- support for arbitrary incidents

## Near-Term Build Plan

1. Define the scenario state machine for one billing failure incident.
2. Define the tool contracts and the stateful mock environment.
3. Build the agent runner and tool loop.
4. Build the incident report artifact writer.
5. Build the Slack-style replay surface for the demo.
6. Add the fix PR and monitoring resolution stages.
7. Rehearse the demo with deterministic output.

## Repository Intent

This repository is the build surface for the hackathon version of Codex Crisis Room.

The short-term goal is not to build every integration. The goal is to build a convincing, real agentic incident-management core that can later be connected to real systems.
