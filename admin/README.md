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
ADMIN_EMAILS=admin@example.com
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

Admin users must have:

```txt
role = ADMIN
```

Normal users must have:

```txt
role = USER
```

Users are also auto-created/updated when they report skill events with `x-user-id`,
`x-user-name`, and `x-user-email` through MCP or the VS Code extension.

After one admin exists, admins can manage users through the dashboard or API:

```txt
http://localhost:3000/admin
GET  /api/users
POST /api/users
```

Admin APIs use the browser login session. Do not enable `ALLOW_HEADER_AUTH=true`
in production unless you intentionally need a local development escape hatch.

## What Admin Can See

- All audit logs in `AuditLog`.
- All admin notifications in `Notification`.
- Which user used/listed/read/imported/tested/executed/edited skills.
- Whether email was sent via `Notification.emailSent` and `Notification.sentAt`.

## Current Auth Status

Google/GitHub login is wired for the Conductor app and admin APIs.
MCP/VS Code event reporting still uses the separate `SKILL_EVENTS_TOKEN` plus user identity headers
because those tools run outside the browser session.
