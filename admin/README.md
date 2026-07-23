# Admin Setup

This folder is for the person or team running the central conductor app.

Admins run the control plane that stores logs, manages users, reviews approvals, and sends notifications.
The skill library itself lives in this repository's `skills/` folder, and MCP `list_skills` should list those local skill folders only.

## Admin Owns

- `conductor-app/` - Next.js control plane and API
- PostgreSQL configured through `conductor-app/.env`
- SMTP credentials configured through `conductor-app/.env`
- Admin and user records in Prisma
- Audit-log, approval, and notification review

## Start Admin App

```bash
cd conductor-app
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Recommended local auth-safe startup:

```bash
npm run dev:local
```

The local launcher is cross-platform. On Windows PowerShell installations that block
`npm.ps1`, use `npm.cmd run dev:local` instead.

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
AUTH_TRUST_HOST=true
ALLOW_FIRST_USER_ADMIN=false
ADMIN_EMAILS=sanayborhade619@gmail.com
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
SKILL_EVENTS_TOKEN=replace-with-a-shared-token
SKILL_EVENTS_HMAC_SECRET=replace-with-a-second-shared-secret
```

You can use GitHub instead of Google by setting `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

For admin email:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-admin-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-admin-email@gmail.com
```

## Login And Create Users

Open:

```txt
http://localhost:3000/login
```

For Google OAuth in local development, configure the Google Cloud OAuth client with:

- Authorized JavaScript origins:
  - `http://localhost:3000`
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`

If the OAuth consent screen is still in testing mode, add your login email as a test user there too.

The first signed-in user becomes admin automatically. Any email in `ADMIN_EMAILS` also becomes admin when that person signs in.

In production, first-user auto-admin is disabled unless `ALLOW_FIRST_USER_ADMIN=true`.

Admin users must have:

```txt
role = ADMIN
```

Normal users must have:

```txt
role = USER
status = ACTIVE
```

New OAuth users are created as `PENDING` unless their email is listed in `ADMIN_EMAILS` or bootstrap admin mode is intentionally enabled. Admins must approve them before they can use protected APIs.

MCP and VS Code users must already exist in Prisma with `status = ACTIVE`. Event reporting rejects unknown, pending, or disabled users even when `SKILL_EVENTS_TOKEN` is valid.

For MCP and VS Code identity, assign each external user a stable `externalUserId` in the admin dashboard or `/api/users`. That value is what users should place into `MCP_USER_ID` or `skillsLibrary.userId`.

After one admin exists, admins can manage users through:

```txt
http://localhost:3000/admin
GET  /api/users
POST /api/users
```

## Admin Dashboard

Open:

```txt
http://localhost:3000/admin
```

The dashboard shows:

- user role management
- user approval, disable, and reactivation controls
- pending skill approval requests
- version history, compare, and restore for skill files
- skill dependency graph and overlap hotspots
- imported workspace intelligence with freshness, risk, and recommended skills
- local GitHub branch health and merge-readiness status
- workflow and notification health summaries
- demo-data seeding and stable release snapshots
- recent audit logs and top action summaries
- recent notifications, unread status, delivery status, retry count, failure reason, and resend controls

Runbooks and the architecture diagram live in `docs/ARCHITECTURE_DIAGRAM_AND_RUNBOOKS.md`.

## Production Security

- Production startup fails if `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAILS`, OAuth, or `SKILL_EVENTS_TOKEN` are missing or weak.
- `AUTH_URL` must use `https://` in production.
- `SKILL_EVENTS_TOKEN` is checked with a timing-safe comparison.
- If `SKILL_EVENTS_HMAC_SECRET` is configured, external event callers must also send:
  - `x-skill-event-id`
  - `x-skill-event-timestamp`
  - `x-skill-event-signature`
- Signed event verification enforces timestamp freshness and replay protection.
- Sensitive mutation endpoints use rate limiting.
- Audit entries include integrity-chain metadata for tamper visibility.
- Security headers are applied globally: HSTS, frame deny, nosniff, referrer policy, permissions policy, and CSP.
- First signed-in user is not auto-admin in production unless `ALLOW_FIRST_USER_ADMIN=true`.

## Role Enforcement

Admin-only actions:

- create, edit, import, restore, or delete filesystem skills
- create, update, or delete registry skills
- create, update, or delete workflows
- manage users
- view or purge audit logs
- clear old notifications
- approve or reject skill change requests

User actions:

- read and list skills from the local `skills/` library
- run skill validation and use actions
- read, list, and execute accessible workflows
- mark only their own notifications as read
- submit skill change requests for admin approval

## Branch Protection

Admins should configure GitHub branch protection for `main` and use `sanay` or another approved personal branch for day-to-day work.

Recommended `main` protection settings:

- require a pull request before merging
- require approvals
- require required status checks to pass
- require branches to be up to date before merging
- require conversation resolution before merging
- do not allow bypassing the rule

Recommended required checks:

- `Enforce personal branch policy`
- `Conductor app checks`
- `MCP server build`
- `VS Code extension build`
- `Full repository verification`
- `Secret scan`
- `Dependency audit`

## Current Auth Status

Google and GitHub login are wired for the conductor app and browser APIs.

MCP and VS Code event reporting use the separate required `SKILL_EVENTS_TOKEN` plus user identity headers because those tools run outside the browser session.
