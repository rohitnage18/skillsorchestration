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
