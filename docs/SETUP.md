# Skill Orchestrator Setup

For the detailed architecture, event flow, admin protection model, and troubleshooting guide, read `README.md`. This file is the shorter setup companion.

## Architecture

The project is now organized around one control plane:

- `skills/` stores the source skill library. Each skill has a `SKILL.md` file and optional `references/*.md` files.
- `skills-mcp-server/` exposes those skills to agents such as Codex, Copilot, Claude, or any MCP-compatible client.
- `skills-vscode-extension/` lets users browse, preview, insert, and watch skills inside VS Code.
- `conductor-app/` owns admin APIs, audit logs, notifications, workflow/registry APIs, and admin email delivery.
- Each imported project gets its own `CONTEXT.md`; agents should read it before work and update it after meaningful changes.

The committed `.vscode/mcp.json` sets:

- `SKILLS_PATH=${workspaceFolder}/skills`
- `PROJECT_PATH=${workspaceFolder}`

That means MCP agents opened at this repo can immediately call `read_context` and `update_context` against the root `CONTEXT.md`.

## Environment

Create `conductor-app/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/skill_orchestration

# Optional, but required for admin email delivery
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASSWORD=your-password
FROM_EMAIL=noreply@example.com

# Optional token for VS Code/external skill event reports
SKILL_EVENTS_TOKEN=change-me

# Optional. When true, conductor UI skill previews are logged as skill:preview
ENABLE_SKILL_PREVIEW_TRACKING=false
```

Admin emails are sent to users in the database with `role = "ADMIN"`.

## Database

From `conductor-app/`:

```bash
npm install
npx prisma generate
npx prisma migrate dev
```

Then create or update at least one admin user:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

For the current local UI, sign in through `/login`.
Browser API routes resolve the user from the Auth.js session.
MCP and VS Code event reporting still send user identity headers, but those calls must also include `SKILL_EVENTS_TOKEN`.

## Run Locally

Terminal 1:

```bash
cd skills-mcp-server
npm install
npm run build
```

Terminal 2:

```bash
cd conductor-app
npm run dev
```

Optional VS Code extension build:

```bash
cd skills-vscode-extension
npm install
npm run build
```

## VS Code Event Reporting

Configure these VS Code settings:

```json
{
  "skillsLibrary.skillsPath": "D:/skill-orchestration-repo/skills",
  "skillsLibrary.conductorUrl": "http://localhost:3000",
  "skillsLibrary.userId": "your-user-id",
  "skillsLibrary.eventToken": "change-me"
}
```

When configured, the extension reports:

- `skill:preview` when a user previews a skill or reference.
- `skill:use` when a user inserts a skill into code.
- `skill:file:update` when `SKILL.md` or `references/*.md` changes.

## Agent Workflow

Expected agent flow:

1. User gives a prompt in Codex, Copilot, Claude, or another agent.
2. Agent calls `read_context` and reads the project `CONTEXT.md` first.
3. Agent selects the relevant skill from `skills/` through MCP or direct file access.
4. Agent reads `SKILL.md` and any required `references/*.md`.
5. Agent initializes or modifies the project.
6. Agent calls `update_context` after meaningful work.
7. Skill use/edit/import events are logged by `conductor-app`.
8. Admin users receive in-app notifications and SMTP email when configured.

## Notes

- Security and strict approval workflows are intentionally still a later phase.
- Current write protection requires an admin database user for skill create/import/edit and admin log cleanup.
- Do not delete `conductor-app`; it is the orchestration control plane.
