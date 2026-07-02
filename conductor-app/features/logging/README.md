# Audit Logging & Notification System

## Overview

A comprehensive audit logging and notification system for the Skill Orchestration project. Tracks all changes (create, update, delete) to skills, workflows, and user actions, with email notifications for admins.

## Features

- **Comprehensive Audit Logging**: All operations logged with full change history
- **Admin Email Notifications**: Automatically notify admins of significant actions
- **Indefinite Retention**: Logs are kept forever (optional cleanup available)
- **Real-time Statistics**: Dashboard-ready stats on operations
- **User-friendly Notifications**: In-app notifications with email delivery tracking

## Database Schema

### AuditLog Table
```
- id: string (cuid)
- userId: string (foreign key to User)
- action: string (e.g., "skill:create", "workflow:update")
- resource: string (e.g., "skill", "workflow")
- resourceId: string (ID of the affected resource)
- changes: JSON (before/after values)
- metadata: JSON (additional context)
- createdAt: DateTime (indexed)
```

### Notification Table
```
- id: string (cuid)
- userId: string (foreign key to User)
- title: string
- message: string
- type: NotificationType (enum)
- auditLogId: string (reference to trigger)
- emailSent: boolean
- sentAt: DateTime
- read: boolean
- readAt: DateTime
- createdAt: DateTime
```

### Updated User Table
```
- role: UserRole (enum: ADMIN, USER)
```

## Integration Guide

### 1. Initialize the Services

In your main application initialization:

```typescript
import { PrismaClient } from "@prisma/client";
import { AuditLogService } from "@/features/logging/auditLog.service";
import { initializeNotificationService } from "@/features/logging/notification.service";

const prisma = new PrismaClient();
const auditLogService = new AuditLogService(prisma);
const notificationService = initializeNotificationService(prisma);
```

### 2. Log an Action

When creating, updating, or deleting a skill:

```typescript
import { logAction } from "@/features/logging/server-functions";

// In your skill creation handler
await logAction({
  userId: currentUser.id,
  action: "skill:create",
  resource: "skill",
  resourceId: newSkill.id,
  changes: {
    before: null,
    after: newSkill,
  },
  metadata: {
    skillType: newSkill.type,
  },
});
```

### 3. Environment Variables

Add to your `.env.local`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/conductor

# Email configuration (optional, if not set, emails won't be sent)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourcompany.com
```

### 4. Run Database Migration

```bash
cd conductor-app
npx prisma migrate dev --name add_audit_logging_and_notifications
```

This creates the `AuditLog` and `Notification` tables.

## API Endpoints

### Audit Logs (Admin Only)

**GET `/api/audit-logs`**
```
Query Parameters:
- userId: Filter by user
- resource: Filter by resource type (skill, workflow)
- action: Filter by action (skill:create, skill:update, etc.)
- limit: Number of results (default: 100)
- offset: Pagination offset (default: 0)

Response:
{
  success: boolean,
  data: AuditLog[]
}
```

**GET `/api/audit-logs/stats?timeframe=week`**
```
Query Parameters:
- timeframe: "day" | "week" | "month"

Response:
{
  success: boolean,
  data: {
    byAction: Record<string, number>,
    byResource: Record<string, number>,
    byUser: Record<string, number>,
    total: number
  }
}
```

**DELETE `/api/audit-logs?olderThanDays=90`**
```
Purge old audit logs (admin only)

Query Parameters:
- olderThanDays: Age threshold in days
```

### Notifications

**GET `/api/notifications`**
```
Query Parameters:
- read: boolean (filter by read status)
- type: NotificationType
- limit: Number of results (default: 50)
- offset: Pagination offset (default: 0)

Response:
{
  success: boolean,
  data: Notification[]
}
```

**GET `/api/notifications/unread-count`**
```
Response:
{
  success: boolean,
  data: { count: number }
}
```

**POST `/api/notifications/mark-read`**
```
Body:
{
  notificationId: string
}

Response:
{
  success: boolean,
  data: Notification
}
```

**DELETE `/api/notifications?olderThanDays=90`**
```
Clear old read notifications

Query Parameters:
- olderThanDays: Age threshold in days
```

## Supported Actions

### Skill Operations
- `skill:create` → `SKILL_CREATED`
- `skill:update` → `SKILL_UPDATED`
- `skill:delete` → `SKILL_DELETED`

### Workflow Operations
- `workflow:create` → `WORKFLOW_CREATED`
- `workflow:update` → `WORKFLOW_UPDATED`
- `workflow:delete` → `WORKFLOW_DELETED`

### Workflow Run Operations
- `workflow:run:start` → `WORKFLOW_RUN_STARTED`
- `workflow:run:complete` → `WORKFLOW_RUN_COMPLETED`
- `workflow:run:fail` → `WORKFLOW_RUN_FAILED`

### Generic
- Any custom action → `USER_ACTION`

## Implementation Examples

### Example 1: Log Skill Creation

```typescript
// In skills/server-functions.ts
export async function createSkill(data: SkillData) {
  const newSkill = await prisma.skill.create({ data });

  await logAction({
    userId: session.user.id,
    action: "skill:create",
    resource: "skill",
    resourceId: newSkill.id,
    changes: { before: null, after: newSkill },
  });

  return newSkill;
}
```

### Example 2: Log Workflow Update

```typescript
export async function updateWorkflow(id: string, data: WorkflowData) {
  const before = await prisma.workflow.findUnique({ where: { id } });
  const after = await prisma.workflow.update({ where: { id }, data });

  await logAction({
    userId: session.user.id,
    action: "workflow:update",
    resource: "workflow",
    resourceId: id,
    changes: { before, after },
  });

  return after;
}
```

### Example 3: Get Audit Report (Admin Dashboard)

```typescript
export async function getAuditReport() {
  const logs = await getAuditLogs({ limit: 100 });
  const stats = await getAuditStats("week");

  return {
    recentActivity: logs.data,
    statistics: stats.data,
  };
}
```

## Email Configuration

### Gmail (Recommended for Development)

1. Enable 2-Step Verification
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character app password in `SMTP_PASSWORD`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
FROM_EMAIL=your-email@gmail.com
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-username
SMTP_PASSWORD=your-ses-password
FROM_EMAIL=verified-email@yourcompany.com
```

### SendGrid

Implement custom SendGrid integration in `notification.service.ts` (placeholder is included).

## Best Practices

1. **Always Log in Transactions**: Log actions after successful database operations
2. **Use Consistent Action Names**: Follow the `resource:operation` pattern
3. **Include Meaningful Changes**: Always include `before` and `after` for updates
4. **Make Email Optional**: Email setup is optional; logging works without it
5. **Regular Cleanup**: Run purge/clear operations periodically for old logs
6. **Authorization**: Add role checks to admin-only endpoints before deploying

## Testing

### Manual Testing

```bash
# Create a test user as admin
cd conductor-app
npx prisma studio

# Add to User table:
# - role: ADMIN
# - email: admin@test.com

# Trigger a skill operation and check:
# - Audit log created
# - Notification created for admins
# - Email logged to console
```

### Integration Tests (Optional)

```typescript
import { AuditLogService } from "@/features/logging/auditLog.service";

describe("AuditLogService", () => {
  it("should log actions", async () => {
    await auditLogService.log({
      userId: "test-user",
      action: "skill:create",
      resource: "skill",
      resourceId: "test-skill",
    });

    const logs = await auditLogService.getLogs({});
    expect(logs).toHaveLength(1);
  });
});
```

## Troubleshooting

### Email Not Sending

1. Check environment variables are set
2. Verify SMTP credentials are correct
3. Check console for error messages
4. Verify `emailSent` and `sentAt` fields in Notification table

### Logs Not Appearing

1. Ensure `logAction()` is being called after successful operations
2. Check database connection
3. Verify migrations have run: `npx prisma migrate status`

### Database Migration Issues

```bash
# Reset database (development only)
npx prisma migrate reset

# View migration status
npx prisma migrate status

# Create migration from schema changes
npx prisma migrate dev --name add_feature
```

## Next Steps

1. ✅ Create database schema
2. ✅ Create logging services
3. ✅ Create API endpoints
4. 📋 Add authorization checks to endpoints
5. 📋 Integrate with existing skill/workflow operations
6. 📋 Create admin dashboard for logs/stats
7. 📋 Add real-time WebSocket notifications (optional)
8. 📋 Set up scheduled cleanup jobs (optional)
