# Project Context

> Read this file first. It is the shared source of truth for the skill orchestration workspace.

## What This Project Is

This repository is a skill orchestration workspace. It lets users maintain reusable `SKILL.md` files with reference material, expose those skills to coding agents, track project context through `CONTEXT.md`, and notify admins when skills are created, imported, used, or edited.

## Architecture Summary

- `skills/` is the source skill library. Each skill folder contains `SKILL.md` and optional `references/*.md`.
- `skills-mcp-server/` exposes skills and project context tools to MCP-compatible agents.
- `skills-vscode-extension/` provides a VS Code sidebar for previewing/inserting skills and reporting skill events.
- `conductor-app/` is the control plane for APIs, audit logging, in-app notifications, SMTP email, registry skills, and workflows.
- Imported projects under `conductor-app/imported-workspaces/` receive their own `CONTEXT.md` file.

## Agent Workflow

1. User gives a prompt to an agent such as Codex, Copilot, Claude, or another MCP-compatible assistant.
2. Agent reads the project `CONTEXT.md` before taking action.
3. Agent selects relevant skill files from `skills/`.
4. Agent reads the selected `SKILL.md` and required `references/*.md`.
5. Agent initializes or modifies the target project/model.
6. Agent updates `CONTEXT.md` after meaningful work.
7. Conductor logs skill activity and notifies admin users.

## Event And Notification Contract

`conductor-app` accepts external skill events at `POST /api/skill-events`.

Supported events:

- `skill:create`
- `skill:import`
- `skill:preview`
- `skill:use`
- `skill:test`
- `skill:execute`
- `skill:file:update`

Each event creates an audit log and admin notification. If SMTP is configured, admin users also receive email.

## Decisions Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-09 | Keep `conductor-app` as the control plane | Admin notifications, audit logs, event APIs, and future approval workflows need a central backend |
| 2026-07-09 | Use DB admin users as email recipients | Keeps notification recipients tied to app roles instead of a separate `ADMIN_EMAIL` list |
| 2026-07-09 | Add `POST /api/skill-events` for VS Code/external reporting | Agents and editor integrations need a small stable event contract |
| 2026-07-09 | Defer strict write-prevention guardrails | The immediate requirement is visibility and admin notification; enforcement can be layered later |
| 2026-07-09 | Point VS Code MCP `PROJECT_PATH` at the workspace | This enables `read_context` and `update_context` immediately for agents opened in this repo |
| 2026-07-09 | Remove root-level notification templates | `conductor-app` is the single notification control plane and Prisma `Notification` is the source of truth |
| 2026-07-16 | Make `main` a manual-PR branch and standardize personal working branches | Delivery safety now depends on branch CI, PR validation, personal branch usage, and GitHub branch protection instead of direct pushes |

## Current Status

| Area | Status | Notes |
|---|---|---|
| Skill library | working | Skills and reference files exist under `skills/` |
| MCP server | working | Exposes skill listing, skill retrieval, and context tools |
| VS Code extension | updated | Reports preview/use/file-update events when `skillsLibrary.conductorUrl` is configured |
| Conductor app | updated | Logs create/import/edit/test/execute events and sends admin email via SMTP |
| Documentation | updated | `README.md` now contains the detailed architecture, setup, event flow, admin protection, and troubleshooting guide |
| Delivery workflow | updated | Branch CI, PR-to-main validation, direct-main guard, and personal-branch policy docs/workflows are in place; GitHub branch protection must still be enabled in the repo settings |
| Skill coverage | updated | The library now covers product management, data engineering, mobile engineering, and AI engineering in addition to the earlier engineering and governance domains |
| User branch ownership | updated | Admins can now store a preferred working branch on each user profile so branch ownership is tracked in the conductor app |
| User activity visibility | updated | Admins now have a dashboard summary of per-user touched skills, workflows, and workspaces derived from the audit trail |
| User lifecycle clarity | updated | Conductor now tracks `lastSeenAt` and supports an explicit `INVITED` status so onboarding and user activity state are clearer |
| External identity mapping | updated | MCP/VS Code users now resolve through an admin-managed `externalUserId`, making external event identity cleaner and safer than using internal DB ids directly |
| Skill governance visibility | updated | Skill ownership and freshness/staleness signals are now surfaced in conductor skill records, skill pages, and admin analytics |
| Skill stability scorecards | updated | The conductor app now assigns each skill a score, grade, and stability lane, and admin analytics highlight stable skills versus watch/at-risk skills |
| Verification layer | updated | The repo now has conductor smoke tests, cross-surface contract tests, a root `npm run verify:repo` command, and a repository-wide GitHub Actions verification workflow |
| Context flow | partial | MCP tools support reading/updating `CONTEXT.md`; strict before/after enforcement is not implemented yet |
| Security/guardrails | updated | OAuth sessions, role/status permissions, non-admin skill-change approvals, signed external events, replay protection, and rate limiting are implemented; production staging and multi-instance coordination remain |

## Open Questions / Blockers

- Decide whether preview/read events are too noisy for admin email in production.
- Decide which shared store or gateway will coordinate rate limiting and replay protection in multi-instance deployments.
- Assign accountable owners and reviewers, then define promotion criteria for every skill.

## Changelog

### 2026-07-22

Reconciled repository guidance with the implemented OAuth, approval, admin, event-security,
and verification flows. Raised the documented Conductor Node.js minimum to the version
required by Next.js 16 and refreshed the remaining hardening roadmap.

Aligned Nodemailer with the Auth.js peer contract, matched the declared Node.js range to
Prisma 7, added a Node.js 24 version file and cross-platform local launchers, deferred
database initialization until first use, and sanitized server/Zod errors returned by APIs.

### 2026-07-09

Implemented the first orchestration slice: real SMTP admin email, shared skill activity logging, conductor event API, filesystem skill create/import/edit/test logging, registry execution logging, and VS Code preview/use/file-update event reporting.

### 2026-07-09

Added root `CONTEXT.md` and updated `.vscode/mcp.json` with `PROJECT_PATH=${workspaceFolder}` so agents can read/update project context through MCP by default.

### 2026-07-09

Added basic admin guardrails: filesystem skill create/import/edit routes, audit log admin routes, and destructive notification cleanup now require an admin database user. Notification mark-read now verifies ownership.

### 2026-07-09

Removed stale root-level notification template files and expanded `README.md` into the detailed operator/developer guide for the skill orchestration system.

### 2026-07-16

Added delivery guardrails for branch-based development: a personal-branch policy workflow,
manual-PR guidance for `main`, updated agent instructions to ask before creating user
branches, and repository documentation covering the GitHub branch protection settings
needed to make `main` truly PR-only.

### 2026-07-16

Expanded the skills library with new domain skills for product management, data engineering,
mobile engineering, and AI engineering, and improved the role/ownership framing across the
existing skills so routing and handoffs are clearer.

### 2026-07-16

Added preferred Git branch tracking to user management in the conductor app so branch
ownership is now stored, editable by admins, and logged through the audit trail.

### 2026-07-16

Added a user activity history view to the admin dashboard so admins can inspect per-user
recent actions and touched skills, workflows, and imported workspaces from the existing
audit log data.

### 2026-07-16

Added clearer user lifecycle handling with `lastSeenAt` tracking and an explicit `INVITED`
status, improving onboarding visibility and making recent-user activity easier to reason
about across browser auth and external event reporting.

### 2026-07-16

Added a first-class `externalUserId` identity mapping for external MCP/VS Code users, plus
admin management and event-resolution logic, so external tool usage now maps onto trusted
approved conductor users without depending on internal database user ids.

### 2026-07-16

Added visible skill-governance signals by surfacing skill owners/reviewers and introducing
freshness-based stale-skill detection in the conductor app's browser, detail, and admin
analytics views.

### 2026-07-16

Added scorecard-based skill governance with quality grades and stability lanes across the
skill browser, individual skill detail views, and admin analytics, then re-verified the
conductor app with a passing test run and production build.

### 2026-07-16

Added a repository-wide verification layer with new conductor smoke tests, cross-surface
contract tests for conductor/MCP/VS Code skill behavior, a root `npm run verify:repo`
command, and a dedicated GitHub Actions verification workflow.
