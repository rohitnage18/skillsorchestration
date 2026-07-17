# Admin Setup

This folder is for the person/team running the central conductor app.

Admins run the backend control plane that stores logs, manages users, and sends email notifications.

## Admin Owns

- `conductor-app/` — Next.js control plane and API.
- PostgreSQL database configured through `conductor-app/.env`.
- SMTP email credentials configured through `conductor-app/.env`.
- Admin/user records in Prisma DB.
- Audit log and notification review.

## Start Admin App

```powershell
cd conductor-app
npm install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev
```

Default local URL:

```txt
http://localhost:3000
```

## Required Environment

Create `conductor-app/.env` from `conductor-app/.env.example`.

Minimum:

```env
DATABASE_URL="postgresql://user:password@host:5432/db?schema=conductor_app"
AUTH_SECRET=replace-with-a-random-secret
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=false
ALLOW_FIRST_USER_ADMIN=false
ADMIN_EMAILS=sanayborhade619@gmail.com
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
```

You can use GitHub instead of Google by setting `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET`.

For admin email:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-admin-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-admin-email@gmail.com
```

Optional event token:

```env
SKILL_EVENTS_TOKEN=replace-with-a-shared-token
```

## Login And Create Users

Open:

```txt
http://localhost:3000/login
```

The first signed-in user becomes admin automatically. Any email in `ADMIN_EMAILS`
also becomes admin when that person signs in.

In production, first-user auto-admin is disabled unless `ALLOW_FIRST_USER_ADMIN=true`.
Prefer setting `ADMIN_EMAILS` before first login.

Admin users must have:

```txt
role = ADMIN
```

Normal users must have:

```txt
role = USER
status = ACTIVE
```

New OAuth users are created as `PENDING` unless their email is listed in `ADMIN_EMAILS`
or bootstrap admin mode is intentionally enabled. Admins must approve them before they can use protected APIs.

Admin-created users can also be stored as `INVITED` before they are activated.

MCP/VS Code users must already exist in Prisma with `status = ACTIVE`. Event reporting will reject
unknown, pending, or disabled users even when `SKILL_EVENTS_TOKEN` is valid.

For MCP/VS Code identity, assign each external user a stable `externalUserId` in the
admin dashboard or `/api/users`. That value is what users should place into
`MCP_USER_ID` or `skillsLibrary.userId`.

After one admin exists, admins can manage users through the dashboard or API:

```txt
http://localhost:3000/admin
GET  /api/users
POST /api/users
```

Admin APIs use the browser login session. Browser requests must not use `x-user-id`
as an auth mechanism.

## Admin Dashboard

Open:

```txt
http://localhost:3000/admin
```

The dashboard shows:

- User role management.
- User approval, disable, and reactivation controls.
- Pending skill approval requests.
- Recent approval decisions.
- Recent audit logs and top action summaries.
- Recent notifications, unread status, delivery status, retry count, failure reason, and resend controls.

## What Admin Can See

- All audit logs in `AuditLog`.
- All admin notifications in `Notification`.
- Which user used/listed/read/imported/tested/executed/edited skills.
- Failed role checks such as non-admin access attempts.
- Admin role changes for team members.
- User approval/disable/reactivation events.
- Whether email was sent via `Notification.emailStatus`, `Notification.emailSent`, `Notification.retryCount`,
  `Notification.emailError`, `Notification.lastAttemptAt`, and `Notification.sentAt`.

## Email Guardrails

- `skill:list` creates an in-app notification but intentionally skips email.
- Missing SMTP config marks notifications as `NOT_CONFIGURED` instead of silently failing.
- Failed SMTP attempts are stored as `FAILED` with `emailError`, `retryCount`, and `lastAttemptAt`.
- Admins can resend failed/pending/not-configured notification emails from `/admin` after fixing SMTP.
- Original user actions still succeed even if email delivery fails.

## Input Safety

- Skill IDs are normalized to lowercase and limited to letters, numbers, hyphens, and underscores.
- File edits are limited to `SKILL.md` and `references/*.md`; traversal paths are rejected.
- Skill file content is limited to `250000` bytes per save/request.
- External skill-event metadata is size/depth bounded before it is stored or emailed.
- Search/filter inputs and approval payloads are sanitized before filesystem or database use.

## Production Security

- Production startup fails if `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAILS`, OAuth, or `SKILL_EVENTS_TOKEN` are missing/weak.
- `AUTH_URL` must use `https://` in production.
- `SKILL_EVENTS_TOKEN` is checked with a timing-safe comparison.
- `AUTH_TRUST_HOST` defaults to trusted only in local development; set it intentionally for your proxy/host.
- Security headers are applied globally: HSTS, frame deny, nosniff, referrer policy, permissions policy, and CSP.
- First signed-in user is not auto-admin in production unless `ALLOW_FIRST_USER_ADMIN=true`.

## Role Enforcement

Admin-only actions:

- Create/edit/import/delete filesystem skills.
- Create/update/delete registry skills.
- Create/update/delete workflows.
- Manage users.
- View/purge audit logs.
- Clear old notifications.
- Approve/reject skill change requests.
- Approve, disable, or reactivate users.

User actions:

- Read/list skills.
- Run skill validation/use actions.
- Read/list/execute accessible workflows.
- Mark only their own notifications as read.

User statuses:

- `INVITED` — created by an admin but not active yet.
- `PENDING` — created but waiting for admin approval.
- `ACTIVE` — allowed to use protected browser, MCP, and VS Code APIs.
- `DISABLED` — blocked from sign-in/API usage until reactivated.

## Skill Approval Flow

Normal users cannot directly create, import, or edit skills. Their request is saved as
`SkillChangeRequest` with `status = PENDING`.

Admins review requests at:

```txt
http://localhost:3000/admin
```

Approving a request applies the actual change and records audit logs. Rejecting a request
keeps the skill library unchanged and stores the rejection status.

## Current Auth Status

Google/GitHub login is wired for the Conductor app and admin APIs.
MCP/VS Code event reporting uses the separate required `SKILL_EVENTS_TOKEN` plus user identity headers
because those tools run outside the browser session.
