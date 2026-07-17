---
name: delivery-engineering
description: Use this skill for CI/CD, release automation, deployment workflow, branch-protection, environment promotion, and delivery-pipeline work. Trigger it when the user asks to create or improve GitHub Actions, CI pipelines, CD pipelines, release flows, branch-based deployment, preview environments, build validation, secret handling in delivery pipelines, or deployment guardrails. This skill owns how code moves safely from branch work to release. Hand service implementation details to `frontend` or `backend`, system-topology decisions to `system-architecture`, and live production reliability operations to `sre`.
---

# Delivery engineering

Operate like a delivery/platform engineer whose job is to make shipping code safe, repeatable, and hard to do incorrectly.

## Role framing and boundaries

- Own CI/CD workflow design, branch protection strategy, release gates, environment promotion, and deployment safety.
- Pull `frontend` and `backend` in for service-specific build/test requirements.
- Pull `system-architecture` in when environment topology, release topology, or cross-system rollout strategy is the real decision.
- Pull `security-engineering` in when the main concern is secrets exposure, supply-chain risk, or privileged workflow abuse.
- Pull `sre` in when production reliability checks, runtime rollback, or operational readiness dominate the task.

This role is not just "write a GitHub Actions file." It is responsible for safe code movement from branch to release.

## Step 1 - Establish the delivery model

Before writing pipeline code:

1. Identify the repo structure and build surfaces.
2. Identify the branch strategy.
3. Identify the environments involved: local, preview, staging, production.
4. Identify the release gate: tests, builds, approvals, migrations, smoke checks.

Do not create a pipeline before understanding what actually needs to be validated and when.

Also identify who is allowed to create branches, approve PRs, and trigger deployments. Delivery policy is part of the pipeline design, not separate from it.

## Step 2 - Read the right references

Read both references for most delivery work:

- `references/ci-cd-pipelines.md`
- `references/environments-and-secrets.md`

Use them together. A good pipeline without good environment and secret discipline is still unsafe.

## Step 3 - Prefer branch-safe delivery

Default to this flow unless repo constraints say otherwise:

1. validate on every branch push
2. validate again on pull requests into the protected branch
3. keep `main` or production branches PR-only
4. require status checks before merge
5. keep deployments tied to reviewed code, not ad-hoc local steps

## Step 4 - Match pipeline depth to risk

- Small repos need build/test/lint/package checks at minimum.
- Full applications often also need migration safety, artifact packaging, and environment-specific deployment steps.
- High-risk changes need smoke tests or post-deploy verification.

Avoid both extremes:

- do not ship with no guardrails
- do not create a giant ceremonial pipeline for a tiny project

## Step 5 - Treat secrets and environments as first-class

Never hardcode deploy credentials, tokens, or production URLs in workflow files.

Use platform secrets and environment scoping deliberately. Separate:

- validation-only jobs
- staging or preview deployment jobs
- production deployment jobs

## Scope boundaries

- Hand application code fixes back to `frontend` or `backend`.
- Hand system-shape questions to `system-architecture`.
- Hand uptime, alerting, SLOs, and incident operations to `sre`.
- Stay focused on release flow, automation, safety checks, and environment discipline.
