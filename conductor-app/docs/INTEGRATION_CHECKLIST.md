# Integration Checklist: Audit Logging & Notifications

## Phase 1: Setup (You Are Here)

- [ ] **1.1 - Database Migration**
  ```bash
  cd conductor-app
  npx prisma migrate dev
  ```
  This creates the `audit_log` and `notification` tables

- [ ] **1.2 - Environment Variables**
  - Copy `.env.logging.example` to `.env.local`
  - Set `DATABASE_URL` to your PostgreSQL connection
  - (Optional) Configure SMTP for email notifications

- [ ] **1.3 - User Roles**
  - Use Prisma Studio to add at least one ADMIN user:
    ```bash
    npx prisma studio
    ```
  - Find a User record and set `role: "ADMIN"` for notifications

- [ ] **1.4 - Verify Setup**
  - Check tables exist: `SELECT * FROM "AuditLog" LIMIT 1;`
  - Check User roles: `SELECT id, email, role FROM "User" LIMIT 5;`

## Phase 2: Integration (Next)

Integrate logging into your existing operations:

- [ ] **2.1 - Skills Operations**
  - [ ] Import `logAction` in [`conductor-app/features/skills/server-functions.ts`](../features/skills/server-functions.ts)
  - [ ] Add `await logAction({...})` after skill create
  - [ ] Add `await logAction({...})` after skill update
  - [ ] Add `await logAction({...})` after skill delete

- [ ] **2.2 - Workflow Operations**
  - [ ] Import `logAction` in the workflow service files under [`conductor-app/features/workflows/`](../features/workflows/)
  - [ ] Add logging to workflow create/update/delete
  - [ ] Add logging to workflow runs (start/complete/fail)

- [ ] **2.3 - Add Authorization**
  - [ ] Add role checks to `/api/audit-logs` endpoints (admin only)
  - [ ] Verify user headers are passed correctly

## Phase 3: Testing

- [ ] **3.0 - Seed Dev Users**
  ```bash
  curl -X POST http://localhost:3000/api/dev/seed-users
  ```
  This creates `dev-admin` as `ADMIN` and `user-1` through `user-5` as `USER`.
  Use the returned `x-user-id` and `x-user-email` headers from VS Code requests.

- [ ] **3.1 - Manual Testing**
  - [ ] Create a test skill and verify audit log created
  - [ ] Check notification created for admin users
  - [ ] Mark notification as read via API

- [ ] **3.2 - Email Testing** (if configured)
  - [ ] Check console logs for email output
  - [ ] Verify SMTP configuration if needed

- [ ] **3.3 - Dashboard Testing**
  - [ ] GET `/api/audit-logs` returns recent changes
  - [ ] GET `/api/audit-logs/stats?timeframe=week` shows stats
  - [ ] Pagination works with `limit` and `offset`

## Phase 4: Optional Enhancements

- [ ] **4.1 - Real-time Notifications**
  - [ ] Add WebSocket support for live updates
  - [ ] Create notification badge component

- [ ] **4.2 - Admin Dashboard**
  - [ ] Create UI for viewing audit logs
  - [ ] Create statistics/chart visualization

- [ ] **4.3 - Scheduled Cleanup**
  - [ ] Set up cron job to purge old logs (if needed)
  - [ ] Set up cron job to clear old notifications

- [ ] **4.4 - Advanced Filtering**
  - [ ] Add date range filters to audit log queries
  - [ ] Add user/resource filtering UI

## Quick Reference: Code Snippets

### Log a Skill Creation
```typescript
import { logAction } from "@/features/logging/server-functions";

const newSkill = await prisma.skill.create({ data });
await logAction({
  userId: session.user.id,
  action: "skill:create",
  resource: "skill",
  resourceId: newSkill.id,
  changes: { before: null, after: newSkill },
});
```

### Log a Workflow Update
```typescript
const before = await prisma.workflow.findUnique({ where: { id } });
const after = await prisma.workflow.update({ where: { id }, data });
await logAction({
  userId: session.user.id,
  action: "workflow:update",
  resource: "workflow",
  resourceId: id,
  changes: { before, after },
});
```

### Get Admin's Unread Notifications
```typescript
const result = await getUnreadNotificationCount(session.user.id);
console.log(`${result.data.count} unread notifications`);
```

## Troubleshooting

**Q: Migration fails with "DATABASE_URL is required"**
A: Set DATABASE_URL in `.env.local` before running migration

**Q: No notifications created**
A: Verify at least one user has `role: "ADMIN"` in the database

**Q: Email not sending**
A: Set SMTP_* environment variables and restart the server

**Q: Logs not appearing**
A: Add `console.log()` to confirm `logAction()` is being called

## File References

- Schema: [`conductor-app/prisma/schema.prisma`](../prisma/schema.prisma)
- Services: [`conductor-app/features/logging/`](../features/logging/)
- API Routes: [`conductor-app/app/api/audit-logs/`](../app/api/audit-logs/)
- Docs: [`conductor-app/features/logging/README.md`](../features/logging/README.md)

---

**Need help?** See [`conductor-app/features/logging/README.md`](../features/logging/README.md) for detailed documentation.
