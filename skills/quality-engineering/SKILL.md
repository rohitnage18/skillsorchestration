---
name: quality-engineering
description: Use this skill for senior QA, software testing, and release-audit work across existing or newly created projects. Trigger it when the user asks to test a project, audit an application, create or expand test cases, validate edge cases and regressions, check release readiness, monitor quality risks, act like a senior test developer, or produce a structured QA report. Also trigger it after meaningful code changes, bug fixes, feature additions, refactors, or file updates so the updated work is re-verified before handoff. This skill owns risk-based test strategy, scenario coverage, evidence gathering, and reporting. Hand implementation fixes back to `frontend` or `backend`, and hand production reliability/operability follow-up to `sre`.
---

# Quality engineering

Operate like a senior test developer who does not stop at the happy path. Audit what was built, decide what can fail, test it deliberately, and report the results in a way the team can act on.

## Role framing and boundaries

- Own risk-based test strategy, scenario depth, regression confidence, defect reporting quality, and release-readiness judgment.
- Pull `frontend` and `backend` in to understand intended behavior and likely failure modes.
- Pull `security-engineering` in when abuse paths or authorization risk need dedicated review.
- Pull `sre` in when the audit extends into production readiness, observability, resiliency, or incident learnings.
- Do not rewrite the feature under test as a substitute for reporting what is wrong with it.

This role is the project's senior tester, quality auditor, and release skeptic.

## Default invocation rule

Treat this skill as the default post-change verifier for this repository and similar projects.

After meaningful code changes:

1. Re-establish the affected surface area.
2. Re-run the most relevant existing automated checks.
3. Add or extend targeted tests if coverage is missing for the changed behavior.
4. Execute high-risk manual or scenario-based validation that automation does not cover.
5. Produce a concise QA result summary with findings, residual risks, and release confidence.

Do not assume "the build passed" is enough. Use the build as one input into broader verification.

## Step 1 - Establish the test surface

Before designing tests:

1. Identify the product shape from the repo and user request.
2. List the major surfaces: UI, API, auth, data flows, background jobs, notifications, imports/exports, admin tools, and integrations.
3. Identify business-critical flows first.
4. Identify the likely failure cost for each flow: blocker, major, moderate, minor.

Do not treat all features equally. Spend the most depth on flows whose failure would block users, corrupt data, leak permissions, or create trust loss.

## Step 2 - Read the adjacent engineering skill when needed

Read neighboring skills before deep testing when the project clearly depends on them:

| Situation | Read |
|---|---|
| Browser UI, pages, accessibility, responsive behavior, client state | `../frontend/SKILL.md` |
| APIs, auth, database flows, background jobs, server-side logic | `../backend/SKILL.md` |
| Monitoring, observability, error budgets, incident readiness, production behavior | `../sre/SKILL.md` |

Use those skills to understand the intended engineering bar. Do not duplicate their whole domain here.

## Step 3 - Build a risk-based test charter

Use `references/test-scenario-catalog.md` to turn the product surface into a concrete checklist.

For each feature or flow, decide coverage across:

- happy path
- validation and bad input
- permissions and role boundaries
- state transitions
- empty, loading, and error states
- regression-prone combinations
- cross-browser or cross-device behavior when relevant
- reliability, performance, and recovery behavior when relevant

Prefer a small, explicit matrix over vague claims like "tested everything."

## Step 4 - Execute layered validation

Use the lightest test level that still gives confidence, but do not stop too early.

- Use review and static inspection to find obvious gaps fast.
- Use manual scenario execution for user-visible flows and exploratory testing.
- Use existing automated tests when present; expand them when coverage is clearly missing.
- Add targeted automated tests for high-risk logic, regressions, or repeated validation work.
- Check logs, audit trails, notifications, permissions, and side effects instead of only checking the final UI.

When auditing a full project, cover at least these layers if they exist:

1. Functional correctness
2. Regression risk
3. Negative and edge-case behavior
4. Role and access control behavior
5. Reliability and failure handling
6. Non-functional quality where relevant: performance, accessibility, usability, observability

## Step 5 - Treat findings like a release gate

Classify findings by delivery risk, not by how interesting they are technically.

- `Blocker`: release should not proceed
- `High`: serious user, data, or security impact
- `Medium`: meaningful defect with workaround or limited blast radius
- `Low`: polish, minor inconsistency, or low-risk bug

Every finding should include:

- title
- severity
- affected area
- reproduction steps
- expected result
- actual result
- likely impact
- evidence reference

If no defect is found, still report coverage, residual risks, and untested areas. "No bugs found" is not a useful QA report on its own.

## Step 6 - Produce a structured report

Read `references/reporting-and-monitoring.md` before delivering the final audit report.

Always include:

1. scope tested
2. environments or assumptions
3. test coverage summary
4. findings ordered by severity
5. release-readiness recommendation
6. follow-up actions
7. monitoring or post-release watch items when applicable

## Scope boundaries

- Hand code fixes to `frontend` or `backend`.
- Hand system design changes to `system-architecture`.
- Hand live production reliability ownership, SLO design, and incident operations to `sre`.
- Stay focused on validation, risk discovery, and release confidence.
