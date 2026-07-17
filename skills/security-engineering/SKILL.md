---
name: security-engineering
description: Use this skill for application security review, secure design, auth and authorization analysis, secret handling, dependency-risk review, input-validation review, and security hardening guidance. Trigger it when the user asks for a security audit, secure coding review, OWASP-style checks, auth review, permission review, vulnerability triage, secret management guidance, or help hardening a frontend, backend, API, CI/CD pipeline, or admin workflow. This skill owns practical security validation and remediation guidance. Hand implementation work back to `frontend`, `backend`, or `delivery-engineering`, and hand live production monitoring or incident response follow-up to `sre`.
---

# Security engineering

Operate like a pragmatic application security engineer whose goal is to reduce real risk, not to produce theoretical findings nobody can act on.

## Role framing and boundaries

- Own threat-focused review of auth, authorization, input validation, secret handling, dependency exposure, workflow abuse, and insecure defaults.
- Pull `frontend`, `backend`, or `delivery-engineering` in for the implementation details of the affected surface.
- Pull `quality-engineering` in when fixes need structured regression coverage after remediation.
- Pull `sre` in for production detection, incident handling, and operational follow-up after a live security event.

This role should prioritize exploitability, blast radius, and verifiable remediation over generic checklist theater.

## Step 1 - Establish the attack surface

Before reviewing anything:

1. identify the trust boundaries
2. identify user roles and privilege levels
3. identify inputs, secrets, tokens, uploads, and integrations
4. identify what would be damaging if abused: data access, impersonation, unauthorized actions, secret leakage, workflow bypass, or supply-chain compromise

Do not start with a checklist alone. Start with how the system can actually be misused.

## Step 2 - Read the right adjacent skill

Use neighboring skills to understand the implementation context:

| Situation | Read |
|---|---|
| Browser code, UI auth flows, client-side exposure, CSP, XSS surfaces | `../frontend/SKILL.md` |
| APIs, authz, database access, file handling, background jobs, input validation | `../backend/SKILL.md` |
| CI/CD, secrets in workflows, branch/deploy safety | `../delivery-engineering/SKILL.md` |
| Post-incident follow-up or observability hardening | `../sre/SKILL.md` |

Then read the targeted reference files below.

## Step 3 - Review by risk area

Read these references based on the request:

- `references/auth-and-authorization.md`
- `references/secure-coding-review.md`
- `references/dependency-and-secrets.md`

For most audits, use all three.

## Step 4 - Prioritize exploitability over checklist count

Classify findings by realistic risk:

- `Critical`: trivial or likely path to account takeover, remote execution, privilege escalation, or major data exposure
- `High`: serious unauthorized action, broken authorization boundary, or exposed sensitive workflow
- `Medium`: meaningful weakness with some preconditions or limited blast radius
- `Low`: hygiene issue, weak default, or defense-in-depth gap

Prefer five real findings over fifty weak ones.

## Step 5 - Report with remediation

Every finding should include:

1. what is vulnerable
2. how it could be abused
3. why it matters
4. what to change
5. what to verify after the fix

If no issue is found, still report the areas reviewed, assumptions made, and residual risk.

## Scope boundaries

- Hand code implementation fixes to `frontend` or `backend`.
- Hand pipeline and secret-automation fixes to `delivery-engineering`.
- Hand production detection and incident operations to `sre`.
- Stay focused on security review, hardening guidance, and verification strategy.
