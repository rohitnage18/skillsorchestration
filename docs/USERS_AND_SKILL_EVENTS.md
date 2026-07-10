# Users And Skill Event Emails

This repo sends admin email when a skill event reaches `conductor-app`.

## What Gets Logged

These actions create an `AuditLog`, an admin `Notification`, and an admin email when SMTP is configured:

- MCP `list_skills` -> `skill:list`
- MCP `get_skill` -> `skill:read`
- VS Code preview -> `skill:preview`
- VS Code insert/use -> `skill:use`
- VS Code skill/reference file edit -> `skill:file:update`
- Conductor skill create/import/edit/test/execute -> `skill:create`, `skill:import`, `skill:file:update`, `skill:test`, `skill:execute`

## Add Users

Admin users can create or update users through the conductor API:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "content-type: application/json" \
  -H "x-user-id: admin-user-id" \
  -d "{\"id\":\"user-1\",\"email\":\"user1@example.com\",\"name\":\"User 1\",\"role\":\"USER\"}"
```

To create the first admin before login/auth is finalized, insert or update it in Prisma:

```ts
await db.user.upsert({
  where: { id: "admin-user-id" },
  update: { email: "admin@example.com", name: "Admin", role: "ADMIN" },
  create: { id: "admin-user-id", email: "admin@example.com", name: "Admin", role: "ADMIN" },
});
```

Admin emails go to every user with `role = "ADMIN"`.

## Configure MCP Users

Set these environment variables in the MCP client/server config:

```json
{
  "CONDUCTOR_URL": "http://localhost:3000",
  "MCP_USER_ID": "user-1",
  "MCP_USER_EMAIL": "user1@example.com"
}
```

Optional, if `SKILL_EVENTS_TOKEN` is set in `conductor-app/.env`:

```json
{
  "SKILL_EVENTS_TOKEN": "same-token"
}
```

When that user calls `list_skills` or `get_skill`, the conductor app records the event and emails admins.

## Configure VS Code Users

Set these VS Code settings per user:

```json
{
  "skillsLibrary.skillsPath": "D:\\skill-orchestration-repo\\skills",
  "skillsLibrary.conductorUrl": "http://localhost:3000",
  "skillsLibrary.userId": "user-1",
  "skillsLibrary.userEmail": "user1@example.com"
}
```

Optional:

```json
{
  "skillsLibrary.eventToken": "same-token"
}
```

## Verify

1. Start `conductor-app`.
2. Use a skill from MCP or VS Code.
3. Check `AuditLog` in Prisma DB.
4. Check `Notification.emailSent = true`.
5. Confirm the admin mailbox receives the email.
