# User Setup

This folder is for normal users who only need to use skills from their laptop.

Users do not need admin database access or SMTP credentials.

## User Needs

- `skills/` - the skill library
- `skills-mcp-server/` - MCP server for `list_skills` and `get_skill`
- optional `skills-vscode-extension/` - VS Code sidebar
- admin-provided `CONDUCTOR_URL`
- admin-provided external user id and email
- required admin-provided `SKILL_EVENTS_TOKEN`

If the admin has configured signed external events, your MCP or extension integration may also need to send:

- `x-skill-event-id`
- `x-skill-event-timestamp`
- `x-skill-event-signature`

The signature format is:

```text
<timestamp>.<eventId>.<rawBody>
```

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

- `list_skills`
- `get_skill`

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

The first time this user calls `list_skills`, `get_skill`, previews, or uses a skill, their event is accepted only if an admin has already created or approved that user in the conductor database.

## What Users Can Do

- list skills
- read skills
- use or insert skills in VS Code
- trigger usage logs for admin visibility
- run validation and usage actions they are allowed to run
- submit skill change requests for admin approval

## What Users Cannot Do

Users should not be able to create, edit, import, restore, or delete skills unless their database role is `ADMIN`.

Users should also not be able to create, edit, or delete workflows unless their database role is `ADMIN`.

All protected APIs require:

- the correct database role
- `status = ACTIVE`

## Skill Approval Flow

If a normal user tries to create, import, or edit a skill from the UI, the app creates a pending approval request instead of applying the change immediately.

Users can request:

- `SKILL_CREATE`
- `SKILL_IMPORT`
- `SKILL_FILE_UPDATE`

The request is saved in the database as `SkillChangeRequest` with `status = PENDING`.

An admin must approve it before the skill files or imported workspace are changed.

## Branch Workflow

If you are contributing code in this repository:

- work only on your personal branch such as `sanay` or `users/<username>`
- do not push directly to `main`
- wait for CI, verification, and security checks to pass on your branch
- merge to `main` only through a manual pull request

## Current Auth Status

The conductor browser app uses Google or GitHub login sessions.

MCP and VS Code run outside that browser session, so they send user identity headers plus the required `SKILL_EVENTS_TOKEN`.

Important:

- the token is not enough by itself
- your `MCP_USER_ID` should match the admin-assigned `externalUserId`
- that user record must already be approved with `status = ACTIVE` in Prisma
