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

## Current Status

| Area | Status | Notes |
|---|---|---|
| Skill library | working | Skills and reference files exist under `skills/` |
| MCP server | working | Exposes skill listing, skill retrieval, and context tools |
| VS Code extension | updated | Reports preview/use/file-update events when `skillsLibrary.conductorUrl` is configured |
| Conductor app | updated | Logs create/import/edit/test/execute events and sends admin email via SMTP |
| Documentation | updated | `README.md` now contains the detailed architecture, setup, event flow, admin protection, and troubleshooting guide |
| Context flow | partial | MCP tools support reading/updating `CONTEXT.md`; strict before/after enforcement is not implemented yet |
| Security/guardrails | partial | Skill create/import/edit and admin cleanup routes require an admin database user; full auth and approval workflows are later-phase work |

## Open Questions / Blockers

- Decide the real authentication/session source that replaces temporary `x-user-id`, browser `localStorage`, and `dev-user` fallback behavior.
- Decide whether preview/read events are too noisy for admin email in production.
- Decide whether strict admin approval should block edits, or just notify admins after edits.

## Changelog

### 2026-07-09

Implemented the first orchestration slice: real SMTP admin email, shared skill activity logging, conductor event API, filesystem skill create/import/edit/test logging, registry execution logging, and VS Code preview/use/file-update event reporting.

### 2026-07-09

Added root `CONTEXT.md` and updated `.vscode/mcp.json` with `PROJECT_PATH=${workspaceFolder}` so agents can read/update project context through MCP by default.

### 2026-07-09

Added basic admin guardrails: filesystem skill create/import/edit routes, audit log admin routes, and destructive notification cleanup now require an admin database user. Notification mark-read now verifies ownership.

### 2026-07-09

Removed stale root-level notification template files and expanded `README.md` into the detailed operator/developer guide for the skill orchestration system.
