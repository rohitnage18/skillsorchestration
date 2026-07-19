# Skill Orchestrator TODO Checklist

## Repo Review Summary

- [x] Skill library exists under `skills/` with `SKILL.md` router files and `references/*.md` files.
- [x] VS Code MCP integration exists in `.vscode/mcp.json` and points to `skills-mcp-server/build/index.js`.
- [x] VS Code MCP integration sets `PROJECT_PATH` so agents can read/update `CONTEXT.md`.
- [x] VS Code sidebar extension exists under `skills-vscode-extension/` for browsing, previewing, and inserting skills.
- [x] Conductor app exists under `conductor-app/` with filesystem skill APIs, registry skill APIs, workflows, audit logs, and notifications.
- [x] Prisma schema in `conductor-app/prisma/schema.prisma` already includes `User.role`, `AuditLog`, and `Notification`.
- [x] `nodemailer` is already listed in `conductor-app/package.json`.
- [x] Admin email notification flow is wired for conductor import/use/edit events and VS Code event reports.

## Current Notification State

- [x] Registry skill create/update/delete operations call `logAction()` in `conductor-app/features/skills/service.ts`.
- [x] `AuditLogService` creates audit rows and calls `notificationService.notifyAdmins()`.
- [x] `NotificationService` creates in-app notifications for admin users.
- [x] `NotificationService.sendEmail()` sends real SMTP mail with `nodemailer` when SMTP env vars are configured.
- [x] Filesystem skill import uses the shared audit/notification path in `conductor-app/lib/skillStorage.js`.
- [x] Filesystem skill import sends admin email through `NotificationService` when SMTP and admin users exist.
- [x] Filesystem skill creation through `/api/skills` creates audit logs, in-app notifications, and emails.
- [x] Filesystem skill file edits through `/api/skills/[skillName]/file` create audit logs, in-app notifications, and emails.
- [x] Skill use/test/execute events are defined for conductor and registry routes.
- [x] Root-level notification helper templates were removed; `conductor-app` owns notification code.
- [x] Notification storage has one source of truth: `Notification` inside `conductor-app/prisma/schema.prisma`.

## Phase 1: Decide Notification Architecture

- [x] Choose one notification model as the source of truth.
- [x] Prefer the existing `conductor-app/prisma/schema.prisma` `Notification` model unless send-attempt history needs a separate table.
- [x] Decide whether to add `NotificationDeliveryLog` or extend `Notification` with `emailError`, `emailStatus`, and retry fields.
- [x] Remove or clearly archive root-level template files after their useful code is merged.
- [x] Update `docs/SETUP.md` so it reflects the actual conductor app implementation, not old copy/paste templates.

## Phase 2: Implement Real Admin Email Sender

- [x] Import `nodemailer` in `conductor-app/features/logging/notification.service.ts`.
- [x] Replace the console-only `sendEmail()` placeholder with a real SMTP transporter.
- [x] Support `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `FROM_EMAIL`.
- [x] Use admin users from the database as email recipients.
- [x] Record failed email attempts in server logs without breaking the original user action.
- [x] Store email delivery state in Prisma with `emailStatus`, `emailError`, `retryCount`, and `lastAttemptAt`.
- [x] Avoid marking all notifications as `emailSent: true` if one admin email fails.
- [x] Add safe HTML escaping for actor names, resource names, file paths, and metadata values.
- [x] Add concise email subjects for `skill:import`, `skill:file:update`, `skill:use`, and registry operations.

## Phase 3: Wire Filesystem Skill Events

- [x] Add shared helper `logSkillActivity()` in `conductor-app/lib/skillStorage.js`.
- [x] Log `skill:create` after `createSkill()` succeeds.
- [x] Log `skill:import` after `importSkill()` succeeds using the shared logging/notification path.
- [x] Log `skill:file:update` after `saveFile()` succeeds.
- [x] Include file metadata for edits: `skillName`, relative path, file type (`SKILL.md` or reference), old hash, new hash, and timestamp.
- [x] Capture the acting user from request headers with a temporary `dev-user` fallback.
- [x] Pass user context from `/api/skills`, `/api/import`, and `/api/skills/[skillName]/file` into storage functions.
- [x] Ensure audit/email failures never prevent creating, importing, or saving a skill.

## Phase 4: Define And Log Skill Usage

- [x] Treat conductor preview (`GET /api/skills/[skillName]`) as `skill:preview` only if admin wants read tracking.
- [x] Treat conductor test/run (`POST /api/skills/[skillName]/run`) as `skill:test`.
- [x] Treat registry execution (`POST /api/registry/skills/[skillId]/execute`) as `skill:execute`.
- [x] Add `logAction()` to `executeRegistrySkill()` after successful execution.
- [x] Add failure logging for failed execution attempts if admin wants visibility into broken skills.
- [x] Decide whether VS Code "insert at cursor" counts as `skill:use`.
- [x] Add throttling or deduplication if preview/read operations become noisy.

## Phase 5: VS Code Integration For Notifications

- [x] Add extension settings for conductor API URL, such as `skillsLibrary.conductorUrl`.
- [x] Add extension settings for user identity.
- [x] When a user previews a skill in VS Code, optionally POST a `skill:preview` event to conductor.
- [x] When a user inserts a skill in VS Code, POST a `skill:use` event to conductor.
- [x] Add a `FileSystemWatcher` for skill files under the configured skills folder.
- [x] On file save/change in VS Code, POST a `skill:file:update` event to conductor.
- [x] Debounce watcher events to avoid duplicate notifications from a single save.
- [x] Make notification calls non-blocking so VS Code preview/insert remains fast.
- [x] Surface notification failures in VS Code output channel, not disruptive popups.

## Phase 6: Add API Endpoint For External Events

- [x] Create `POST /api/skill-events`.
- [x] Validate event payload with `zod`.
- [x] Accept event types: `skill:import`, `skill:use`, `skill:preview`, `skill:file:update`, `skill:create`, `skill:test`, and `skill:execute`.
- [x] Require bearer token auth with `SKILL_EVENTS_TOKEN`.
- [x] Store `source` metadata such as `conductor-ui`, `vscode-extension`, `mcp-server`, or `filesystem-watcher`.
- [x] Return success even if email delivery fails.

## Phase 7: Security And Authorization

- [x] Add production startup validation for required auth, OAuth, admin, and event-token env vars.
- [x] Require `https://` `AUTH_URL` and strong non-placeholder secrets in production.
- [x] Disable first-user auto-admin in production unless explicitly enabled.
- [x] Use timing-safe comparison for `SKILL_EVENTS_TOKEN`.
- [x] Add signed external event verification with `SKILL_EVENTS_HMAC_SECRET`, timestamp freshness checks, and replay protection.
- [x] Add global production security headers through Next middleware.
- [x] Replace browser `x-user-id`, `localStorage`, and `dev-user` fallback with real session/user resolution.
- [x] Add `User.status` approval flow with `PENDING`, `ACTIVE`, and `DISABLED`.
- [x] Require admin approval before new OAuth users can use protected APIs.
- [x] Reject unknown/pending/disabled MCP and VS Code event users.
- [x] Add admin approve, disable, and reactivate controls for users.
- [x] Add admin authorization checks to `/api/audit-logs`.
- [x] Add admin authorization checks to skill create/import/edit/delete routes.
- [x] Add admin authorization checks to registry skill create/update/delete routes.
- [x] Add admin authorization checks to workflow create/update/delete routes.
- [x] Add user authorization checks to skill test/use, registry execution, workflow execution, and user notifications.
- [x] Add `SkillChangeRequest` model for skill approval flow.
- [x] Add skill change request create/list/approve/reject APIs.
- [x] Route user skill create/import/file-edit attempts into pending approval requests.
- [x] Add pending approval controls to admin dashboard.
- [x] Log denied role checks as `auth:role-denied` audit records.
- [x] Log admin role changes as `user:role:update` audit records.
- [x] Add admin authorization checks to destructive notification cleanup endpoints.
- [x] Add rate limiting on sensitive mutation and external event endpoints.
- [x] Add finer-grained permission checks for admin-sensitive APIs beyond broad route-level admin checks.
- [x] Add audit-log integrity hashing so entries carry chain metadata.
- [x] Ensure users cannot mark another user's notification as read.
- [x] Prevent path traversal for all filesystem skill operations.
- [x] Restrict file edits to `SKILL.md` and `references/*.md` unless broader editing is intentional.
- [x] Normalize and validate skill names before filesystem/database use.
- [x] Add file content size limits for skill edits and approval requests.
- [x] Bound external skill-event metadata size/depth before audit logging and email rendering.
- [x] Sanitize search/filter inputs for filesystem skill listing.
- [x] Avoid emailing full sensitive file contents; email only metadata and links.

## Phase 7A: Context Workflow

- [x] Add root `CONTEXT.md` for this orchestration workspace.
- [x] Configure `.vscode/mcp.json` with `PROJECT_PATH=${workspaceFolder}`.
- [x] Document that agents should call `read_context` before work.
- [x] Document that agents should call `update_context` after meaningful work.
- [x] Add UI affordance in conductor app for viewing/editing imported project `CONTEXT.md` files.
- [x] Add optional context event logging when `CONTEXT.md` changes.

## Phase 8: Admin UX

- [x] Add admin page for recent audit logs.
- [x] Add admin page for notifications and email delivery status.
- [x] Add filters by event type, user, skill, source, and date.
- [x] Add unread notification badge in the conductor UI.
- [x] Add "mark as read" and "mark all as read" actions.
- [x] Add resend email action for failed delivery attempts if delivery logs are stored.

## Phase 9: Testing And Validation

- [x] Add unit tests for email config parsing and missing SMTP behavior.
- [x] Add unit tests for event-to-notification mapping.
- [x] Add integration test for filesystem skill import notification.
- [x] Add integration test for filesystem `SKILL.md` edit notification.
- [x] Add integration test for reference file edit notification.
- [x] Add integration test for registry skill execution notification.
- [x] Add extension-side test or manual checklist for VS Code insert/use event.
- [x] Run `npm run build` in `conductor-app`.
- [x] Run `npm run build` in `skills-vscode-extension`.
- [x] Run `npm run build` in `skills-mcp-server`.
- [x] Add security tests for rate limiting, replay protection, and signed event verification.

## Recommended Implementation Order

- [x] First, make `NotificationService.sendEmail()` real and reliable.
- [x] Second, add a single reusable skill event logger in the conductor app.
- [x] Third, wire conductor UI import/edit/run routes to that logger.
- [x] Fourth, add the external event API for VS Code.
- [x] Fifth, update the VS Code extension to report use/edit events.
- [x] Sixth, clean up old root-level notification templates and refresh docs.


