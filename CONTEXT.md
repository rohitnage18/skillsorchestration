# Project Context

> Agents must read this file before starting work and update it after meaningful changes.

## Project Overview

This repository is a skill orchestration workspace. It stores reusable `SKILL.md` files with reference material, exposes them to coding agents through MCP and VS Code, tracks active project state through `CONTEXT.md`, and notifies admins when skills are created, imported, used, tested, executed, or edited.

## Stack

- Next.js conductor app for admin APIs, audit logs, notifications, registry skills, and workflows.
- Prisma with PostgreSQL for users, audit logs, notifications, registry skills, and workflows.
- MCP server for exposing skills and context tools to agents.
- VS Code extension for browsing, previewing, inserting, and reporting skill activity.
- Filesystem skill library under `skills/`.

## Architecture Summary

- `skills/` is the source skill library. Each skill folder contains `SKILL.md` and optional `references/*.md`.
- `skills-mcp-server/` exposes `list_skills`, `get_skill`, `read_context`, and `update_context` to agents.
- `skills-vscode-extension/` provides the editor UI and reports skill preview/use/file-update events to the conductor app when configured.
- `conductor-app/` is the control plane for audit logging, notifications, SMTP admin email, registry skills, workflows, and imported project workspaces.
- `conductor-app/imported-workspaces/<project>/CONTEXT.md` is created automatically when a skill is imported into a project workspace.

## Agent Workflow

1. Read `CONTEXT.md` before selecting skills or editing code.
2. Use `list_skills` to find relevant skills.
3. Use `get_skill` to read the selected `SKILL.md` and reference files.
4. Apply the skill to initialize or modify the target project.
5. Update `CONTEXT.md` with changed status, decisions, blockers, and changelog notes after meaningful work.
6. Use the conductor event API or VS Code extension reporting to log skill usage for admin visibility.

## Event And Notification Contract

`conductor-app` accepts external skill activity at `POST /api/skill-events`.

Supported actions:

- `skill:create`
- `skill:import`
- `skill:preview`
- `skill:use`
- `skill:test`
- `skill:execute`
- `skill:file:update`

Each accepted event creates an audit log and admin notification. If SMTP is configured, admin users receive email.

## Current Status

- Skill files and references exist under `skills/`.
- MCP server supports skill discovery, skill retrieval, and project context read/update tools.
- VS Code MCP config now points `PROJECT_PATH` at this workspace, enabling `read_context` and `update_context`.
- Conductor app logs skill create/import/edit/test/execute events and can send SMTP email to admin users.
- VS Code extension can report preview/use/file-update events when `skillsLibrary.conductorUrl` is configured.
- Admin/user guardrails and approval flows are in place for protected conductor operations.
- Conductor admin UI now supports skill file version history, side-by-side comparison, and restore actions.
- A new `skill-authoring` meta-skill exists to scaffold future skills using existing library conventions.
- Conductor admin UI now supports viewing and editing imported workspace `CONTEXT.md` files.
- Conductor can optionally log `skill:preview` and `context:update` events for conductor-managed workflows.
- Conductor includes basic Node-based tests for notification config parsing and action-to-notification mapping.
- Conductor now includes integration-style tests for filesystem import/edit notification logging and registry execution logging.
- A new `quality-engineering` skill now covers senior QA-style project audits, scenario-based testing, and structured release reporting.
- GitHub Actions workflows now validate branch pushes and pull requests, with a documented branch-protection policy to keep `main` PR-only.
- Repository instructions now treat `quality-engineering` as the default post-change verification skill after meaningful code updates.
- The skill library now includes expanded frontend references for Next.js and Tailwind plus a dedicated `delivery-engineering` skill for CI/CD and release automation work.
- The skill library now also includes dedicated `product-management`, `data-engineering`, `mobile`, and `ai-engineering` skills so product strategy, data pipelines, mobile app work, and AI feature design have first-class role coverage.
- The conductor skill browser and filesystem skill model now support inferred tags, quality/health metadata, richer validation, and lightweight skill-library analytics.
- The library now includes a `security-engineering` skill, and skill validation automatically generates reusable QA report artifacts stored in the conductor data workspace.
- The admin dashboard now surfaces skill-library analytics including tags, quality states, at-risk skills, and recent QA report activity.
- Skill validation now includes prompt-trigger coverage checks so weak or overly vague skill descriptions can be flagged against realistic sample user requests.
- The conductor admin workflow now supports storing a preferred Git branch per user so branch ownership can be tracked directly on user profiles.
- The admin dashboard now also summarizes user activity history from audit logs, including touched skills, workflows, and imported workspaces per active user.
- The user lifecycle model now includes explicit `INVITED` and `lastSeenAt` tracking so onboarding and recent-user visibility are clearer across browser auth and external skill-event usage.
- External MCP/VS Code users now resolve through an admin-managed `externalUserId` mapping instead of depending on raw internal Prisma user IDs, reducing identity mismatch risk across browser and external-tool flows.
- The skill browser, skill detail view, and admin analytics now surface skill owners/reviewers and stale-skill freshness signals so library governance is more visible.
- The conductor app now also computes per-skill scorecards with score, grade, and stability signals, and the latest governance pass was re-verified with both `npm test` and `npm run build` on July 16, 2026.
- The repository now includes a repo-level `npm run verify:repo` command, conductor smoke tests, and cross-surface contract tests that verify shared skill behavior across conductor, the MCP server, and the VS Code extension.

## Open Questions / Blockers

- Replace temporary `x-user-id` and `dev-user` behavior with the real auth/session source.
- Decide whether preview events should email admins or only create audit logs.
- Decide whether future admin protection should block edits before they happen or notify admins after they happen.

## Decisions Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-09 | Keep `conductor-app` as the control plane | Admin notifications, event APIs, registry operations, and future approval flows need a central backend |
| 2026-07-09 | Use MCP `CONTEXT.md` tools for agent memory | Agents need a project-local source of truth they can read before and update after work |
| 2026-07-09 | Defer strict edit blocking | Current priority is workflow visibility and admin notification |

## Changelog

### 2026-07-09

Added root `CONTEXT.md` so MCP agents can read and update project context for this workspace.

### 2026-07-13

Added conductor-managed skill version history with admin compare and restore support, created the `skill-authoring` meta-skill for structured future skill creation, and added a formal implementation report under `docs/IMPLEMENTATION_REPORT_2026-07-13.md`.

### 2026-07-15

Completed more of the remaining orchestration checklist by adding imported workspace context management to the admin dashboard, optional conductor-side preview/context event logging, Node-based notification helper tests, and a manual VS Code insert/use validation checklist. The remaining unchecked TODO items are the deeper end-to-end notification integration tests.

### 2026-07-15

Finished the remaining TODO checklist items by adding integration-style tests for filesystem skill import notification logging, `SKILL.md` edit logging, reference edit logging, and registry skill execution logging. `conductor-app` now passes both `npm test` and `npm run build` with the full checklist completed.

### 2026-07-15

Added the `quality-engineering` skill so agents can act as senior test developers: audit projects, derive scenario coverage, validate risk-heavy flows, and produce structured QA reports with release recommendations.

### 2026-07-15

Added GitHub Actions CI/CD workflows for branch pushes and pull requests to `main`, plus a direct-push guard and a documented GitHub branch-protection setup so generated or edited code flows through branches instead of going straight to `main`.

### 2026-07-15

Updated repository instructions so `quality-engineering` is invoked as the default senior-tester workflow after meaningful code changes, combining automated checks with scenario-based QA review and reporting.

### 2026-07-15

Expanded the skill library by adding `frontend` references for Next.js and Tailwind CSS and creating a new `delivery-engineering` skill with references for CI/CD pipelines and environment/secret handling.

### 2026-07-15

Added the first discovery-and-quality foundation layer for the skill library: inferred skill tags, quality metadata, reusable skill validation, analytics summaries, richer skill browser cards, and aligned metadata support in the MCP server and VS Code extension.

### 2026-07-15

Added the `security-engineering` skill with focused auth, secure-coding, and dependency/secret review references, and extended conductor skill validation so each run now generates and stores a structured QA report artifact that is surfaced back through the skill APIs and UI.

### 2026-07-15

Extended the admin dashboard with a dedicated skill analytics section so admins can monitor library health, quality-state distribution, top tags, at-risk skills, and recent QA validation reports without leaving the admin workflow.

### 2026-07-15

Extended skill validation with prompt-trigger coverage analysis so each skill is now checked not only for file quality and references, but also for whether its frontmatter description would match realistic user prompts in practice.

### 2026-07-16

Expanded the skill library again by tightening role framing across the existing skills and adding four new specialist skills: `product-management`, `data-engineering`, `mobile`, and `ai-engineering`, each with focused reference files to keep the routing layer lean.

### 2026-07-16

Added preferred Git branch tracking to conductor user profiles, including schema support, admin editing, API exposure, and audited branch-update events so user-to-branch ownership is now a first-class part of the admin workflow.

### 2026-07-16

Added an admin-visible user activity history view backed by audit logs so admins can see which users recently touched which skills, workflows, and imported workspaces without manually filtering raw logs.

### 2026-07-16

Added `lastSeenAt` tracking and an explicit `INVITED` onboarding state to conductor user management, with updates flowing through browser sign-in, external skill-event reporting, admin messaging, and the user-management API.

### 2026-07-16

Unified the external-tool identity flow further by adding `externalUserId` to conductor users, exposing it in admin user management and `/api/users`, and updating external skill-event resolution so MCP/VS Code activity maps to trusted approved users without requiring raw internal database IDs.

### 2026-07-16

Improved skill governance by surfacing skill ownership metadata in the browser/detail/admin views and adding freshness-based stale-skill detection with analytics support for owned, unowned, and stale skills.

### 2026-07-16

Added skill scorecards and stable-skill analytics to the browser, detail view, and admin dashboard so each skill now has a visible quality score, grade, and stability lane. This version was verified again with passing `conductor-app` tests and production build output.

### 2026-07-16

Added a stronger continuous-testing layer: conductor smoke tests, cross-surface skill contract tests, a repo-wide `npm run verify:repo` command, and a GitHub Actions repository-verification workflow. The full stack passed verification on July 16, 2026.
