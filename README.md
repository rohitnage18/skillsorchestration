# Skill Orchestration Workspace

This repository is a complete local skill orchestration system for coding agents. It stores reusable `SKILL.md` files, exposes them to agents through MCP and VS Code, keeps per-project `CONTEXT.md` files up to date, and notifies admins when skills are created, imported, used, tested, executed, or edited.

## What The System Does

The intended flow is:

1. A user gives a prompt to an agent such as Codex, Copilot, Claude, or another MCP-compatible assistant.
2. The agent reads the active project `CONTEXT.md` first.
3. The agent discovers relevant skills from the shared `skills/` library.
4. The agent reads the selected skill's `SKILL.md` file and required `references/*.md` files.
5. The agent initializes or modifies the target project/model using those instructions.
6. The agent updates `CONTEXT.md` after meaningful work.
7. The conductor app logs skill activity.
8. Admin users receive in-app notifications and, when SMTP is configured, email notifications.

## Repository Layout

| Path | Purpose |
|---|---|
| `admin/` | Admin setup guide and environment template for running the conductor app, DB, SMTP, user management, and audit review. |
| `users/` | User setup guide plus MCP/VS Code config examples for consuming skills and reporting usage. |
| `skills/` | Source skill library. Each skill folder contains `SKILL.md` and optional `references/*.md`. |
| `skills-mcp-server/` | MCP server that exposes skills and context tools to coding agents. |
| `skills-vscode-extension/` | VS Code sidebar extension for browsing, previewing, inserting, and reporting skill activity. |
| `conductor-app/` | Next.js control plane for APIs, audit logs, notifications, SMTP email, registry skills, workflows, and imported workspaces. |
| `docs/SETUP.md` | Short setup companion for local development. |
| `docs/TODO_CHECKLIST.md` | Implementation checklist and remaining roadmap. |
| `docs/USERS_AND_SKILL_EVENTS.md` | User setup and skill event email flow. |
| `CONTEXT.md` | Root project context used by MCP agents in this workspace. |
| `PROJECT_CONTEXT.md` | Human/project architecture context for this repository. |
| `.vscode/mcp.json` | VS Code MCP config for the local skills server. |

## Admin Vs User Setup

- Admins should start with `admin/README.md`.
- Normal users should start with `users/README.md`.
- Shared source code stays in `conductor-app/`, `skills/`, `skills-mcp-server/`, and `skills-vscode-extension/` so paths do not break.
- Users do not need admin SMTP secrets or direct DB access.
- Users enter their own id/name/email in MCP or VS Code config; their first skill event saves them to the conductor database.

## Current Architecture

### Skill Library

Skills live under `skills/`.

Expected shape:

```text
skills/
  backend/
    SKILL.md
    references/
      nodejs.md
      python.md
  frontend/
    SKILL.md
    references/
      react.md
      vue.md
```

`SKILL.md` acts as the router/instruction file. Reference files contain deeper implementation guidance.

### MCP Server

`skills-mcp-server/` exposes:

- `list_skills` - lists available skills.
- `get_skill` - returns a skill's `SKILL.md` plus references.
- `read_context` - reads `CONTEXT.md` from `PROJECT_PATH`.
- `update_context` - rewrites named sections and appends a changelog entry.

The committed `.vscode/mcp.json` sets:

```json
{
  "SKILLS_PATH": "${workspaceFolder}/skills",
  "PROJECT_PATH": "${workspaceFolder}"
}
```

That means agents opened in this repo can immediately read and update the root `CONTEXT.md`.

### Conductor App

`conductor-app/` is the control plane. Keep it.

It owns:

- Filesystem skill APIs.
- Registry skill APIs.
- Workflow APIs.
- Audit logs.
- In-app notifications.
- SMTP admin email.
- External event ingestion through `POST /api/skill-events`.
- Imported project workspaces under `conductor-app/imported-workspaces/`.

The conductor app is now the single source of truth for notifications. Old root-level notification template files were removed to avoid competing implementations.

### VS Code Extension

`skills-vscode-extension/` provides:

- Skill tree sidebar.
- Skill preview.
- Insert-at-cursor.
- File watcher for `SKILL.md` and `references/*.md`.
- Optional conductor event reporting.

When configured with `skillsLibrary.conductorUrl`, it reports:

- `skill:preview`
- `skill:use`
- `skill:file:update`

## Event And Notification Flow

Events enter the system from three places:

1. Conductor UI/API actions.
2. Registry skill execution.
3. VS Code extension reporting.

All roads lead to the conductor app audit/notification path.

Supported event types:

| Event | Meaning |
|---|---|
| `skill:create` | A new filesystem skill was created. |
| `skill:import` | A skill was imported into a project workspace. |
| `skill:preview` | A user previewed a skill or reference file. |
| `skill:use` | A user inserted or used a skill. |
| `skill:test` | A filesystem skill validation/test was run. |
| `skill:execute` | A registry skill was executed. |
| `skill:file:update` | `SKILL.md` or a reference file was edited. |

Each accepted event:

1. Creates an `AuditLog` row.
2. Creates `Notification` rows for admin users.
3. Sends SMTP email to admin users if SMTP is configured.
4. Does not break the user action if notification/email delivery fails.

## Notification Architecture

The source of truth is:

- `conductor-app/prisma/schema.prisma`
- `AuditLog`
- `Notification`
- `User.role`

Admin recipients are database users with:

```text
role = ADMIN
```

SMTP configuration is optional. If SMTP is absent, the app still writes audit logs and in-app notifications.

Required SMTP env vars:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASSWORD=your-password
FROM_EMAIL=noreply@example.com
```

## Admin Protection

Basic admin protection is implemented for skill tampering.

Admin-only actions:

- Create a filesystem skill.
- Import a skill into a workspace.
- Edit `SKILL.md`.
- Edit `references/*.md`.
- View/purge audit logs.
- Clear old notifications.

Current temporary identity mechanism:

- API routes read `x-user-id`.
- Browser UI sends `x-user-id` from `localStorage.skillsConductorUserId`.
- The matching database user must have `role = ADMIN`.
- Admin-only user management is available at `GET /api/users` and `POST /api/users`.

Set a local admin user in the browser:

```js
localStorage.setItem("skillsConductorUserId", "admin-user-id")
```

This is intentionally a temporary bridge. Full authentication/session handling is still a later roadmap item.

## Guardrails Currently Implemented

- Skill file edits are restricted to:
  - `SKILL.md`
  - `references/*.md`
- Path traversal is blocked for filesystem skill operations.
- Admin notification emails include metadata and hashes, not full file contents.
- A user cannot mark another user's notification as read.
- Audit/email failures do not block the primary skill action.

## Guardrails Still Later

These are intentionally not fully implemented yet:

- Real authentication provider.
- Approval workflow before non-admin edits.
- Fine-grained roles beyond `ADMIN` and `USER`.
- Rate limiting for noisy preview events.
- Admin dashboard UI for audit logs and notifications.
- Notification delivery retry queue.

## Setup

### 1. Install Prerequisites

Install:

- Git
- Node.js 18 or newer
- npm
- PostgreSQL
- Python 3.10+ if you need Python helper scripts/tests

### 2. Install Dependencies

Root workspace:

```bash
npm install
```

Conductor app:

```bash
cd conductor-app
npm install
```

MCP server:

```bash
cd ../skills-mcp-server
npm install
npm run build
```

VS Code extension:

```bash
cd ../skills-vscode-extension
npm install
npm run build
```

### 3. Configure Conductor Environment

Create `conductor-app/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/skill_orchestration

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASSWORD=your-password
FROM_EMAIL=noreply@example.com

SKILL_EVENTS_TOKEN=change-me
```

`SKILL_EVENTS_TOKEN` is optional. If set, external callers such as the VS Code extension must send:

```text
Authorization: Bearer change-me
```

### 4. Apply Database Schema

From `conductor-app/`:

```bash
npx prisma generate
npx prisma migrate dev
```

Create or update an admin user:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

### 5. Run Locally

Terminal 1:

```bash
cd skills-mcp-server
npm run build
```

Terminal 2:

```bash
cd conductor-app
npm run dev
```

Then open the conductor app in the browser and set:

```js
localStorage.setItem("skillsConductorUserId", "admin-user-id")
```

### 6. Configure VS Code Extension Reporting

In VS Code settings:

```json
{
  "skillsLibrary.skillsPath": "D:/skill-orchestration-repo/skills",
  "skillsLibrary.conductorUrl": "http://localhost:3000",
  "skillsLibrary.userId": "admin-user-id",
  "skillsLibrary.eventToken": "change-me"
}
```

If `skillsLibrary.conductorUrl` is empty, the extension still works locally but does not report events.

## Agent Workflow In Detail

### Before Work

The agent should:

1. Call `read_context`.
2. Understand the current architecture, decisions, status, and blockers.
3. Call `list_skills`.
4. Choose the smallest relevant skill.
5. Call `get_skill` for that skill.
6. Read any included references before coding.

### During Work

The agent should:

1. Apply the selected skill's guidance.
2. Keep changes focused.
3. Avoid modifying skill source files unless explicitly requested and permitted.
4. Use conductor/VS Code event reporting when skills are used or edited.

### After Work

The agent should:

1. Call `update_context`.
2. Update changed sections only.
3. Append a changelog entry with what changed and why.
4. Run focused validation builds/tests when practical.

## Useful Commands

Build conductor app:

```bash
cd conductor-app
npm run build
```

Build MCP server:

```bash
cd skills-mcp-server
npm run build
```

Build VS Code extension:

```bash
cd skills-vscode-extension
npm run build
```

Open Prisma Studio:

```bash
cd conductor-app
npx prisma studio
```

Run Python tests:

```bash
pytest
```

## Current Validation Status

The following builds pass:

- `conductor-app`: `npm run build`
- `skills-mcp-server`: `npm run build`
- `skills-vscode-extension`: `npm run build`

## Troubleshooting

### `DATABASE_URL is required`

Create `conductor-app/.env` and set `DATABASE_URL`.

### Admin action returns `403`

Check that:

1. The request sends `x-user-id`.
2. That user exists in the database.
3. The user has `role = ADMIN`.

For local browser testing:

```js
localStorage.setItem("skillsConductorUserId", "admin-user-id")
```

### Emails are not sent

Check:

1. SMTP env vars exist in `conductor-app/.env`.
2. At least one database user has `role = ADMIN`.
3. The admin user has a valid email.
4. The SMTP provider accepts the credentials.

### VS Code events are not reported

Check:

1. `skillsLibrary.conductorUrl` is set.
2. `conductor-app` is running.
3. `skillsLibrary.eventToken` matches `SKILL_EVENTS_TOKEN` if the token is configured.
4. The VS Code output channel named `Skills Library` for event reporting errors.

### MCP context tools do not work

Check:

1. `skills-mcp-server` has been built.
2. `.vscode/mcp.json` includes `PROJECT_PATH`.
3. `CONTEXT.md` exists at the workspace root.
4. Reload VS Code after changing MCP config.

## Roadmap

Next major steps:

1. Add real authentication/session handling.
2. Add admin dashboard pages for audit logs and notifications.
3. Add filters for event type, user, skill, source, and date.
4. Add notification badge and mark-all-read UI.
5. Add optional retry/delivery log support for failed SMTP sends.
6. Add tests for notification mapping and skill event flows.
