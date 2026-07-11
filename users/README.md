# User Setup

This folder is for normal users who only need to use skills from their laptop.

Users do not need admin database access or SMTP credentials.
They only enter their own user id, name, and email in local config.
When they use a skill, the conductor app automatically saves/updates that user in the database.

## User Needs

- `skills/` — the skill library.
- `skills-mcp-server/` — MCP server for `list_skills` and `get_skill`.
- Optional: `skills-vscode-extension/` — VS Code sidebar.
- Admin-provided `CONDUCTOR_URL`.
- Admin-provided user id/email.
- Required admin-provided `SKILL_EVENTS_TOKEN`.

## Install MCP Server

```powershell
cd skills-mcp-server
npm install
npm.cmd run build
```

## VS Code MCP Config

Use `.vscode/mcp.json` or copy from `users/mcp.example.json`.

Each user should have their own identity:

```json
{
  "MCP_USER_ID": "user-1",
  "MCP_USER_NAME": "User One",
  "MCP_USER_EMAIL": "user1@example.com"
}
```

When the user calls:

- `list_skills` — stored in the database without admin email.
- `get_skill` — stored in the database and emailed to admins.

the conductor app stores the log for admin visibility.

## VS Code Extension Config

Copy settings from `users/vscode-settings.example.json`.

Set:

```json
{
  "skillsLibrary.skillsPath": "D:\\skill-orchestration-repo\\skills",
  "skillsLibrary.conductorUrl": "http://admin-server:3000",
  "skillsLibrary.userId": "user-1",
  "skillsLibrary.userName": "User One",
  "skillsLibrary.userEmail": "user1@example.com"
}
```

The first time this user calls `list_skills`, `get_skill`, previews, or uses a skill,
their event is accepted only if an admin has already created/approved that user in the conductor database.

## What Users Can Do

- List skills.
- Read skills.
- Use/insert skills in VS Code.
- Trigger usage logs for admin visibility.

## What Users Cannot Do

Users should not be able to create, edit, or import skills unless their database role is `ADMIN`.
Users should also not be able to create, edit, or delete workflows unless their database role is `ADMIN`.

Admin-protected APIs check the database user role.
All protected APIs also require `status = ACTIVE`.

## Input Rules

- Skill names can use letters, numbers, hyphens, and underscores only.
- Skill file update requests can only target `SKILL.md` or `references/*.md`.
- Skill file content is limited to `250000` bytes.
- Event metadata should be small and shallow; oversized metadata is rejected by the conductor app.

If a normal user tries to create, import, or edit a skill from the UI, the app creates a
pending approval request instead of applying the change immediately.

Normal users can:

- List/read skills.
- Run skill validation/use actions.
- List/read/execute workflows they can access.
- Mark their own notifications as read.
- Submit skill change requests for admin approval.

## Skill Approval Flow

Users can request:

- `SKILL_CREATE`
- `SKILL_IMPORT`
- `SKILL_FILE_UPDATE`

The request is saved in the database as `SkillChangeRequest` with `status = PENDING`.
An admin must approve it before the skill files or imported workspace are changed.

## Current Auth Status

The Conductor browser app uses Google/GitHub login sessions.
MCP and VS Code run outside that browser session, so they send user identity headers plus
the required `SKILL_EVENTS_TOKEN`.

Important: the token is not enough by itself. Your `MCP_USER_ID` must match an approved
`ACTIVE` user record in Prisma.
