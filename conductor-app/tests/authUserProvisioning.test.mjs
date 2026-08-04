import test from "node:test";
import assert from "node:assert/strict";

import { upsertAuthenticatedUser } from "../lib/authUserProvisioning.js";

function makeDatabase(existingUser = null, count = existingUser ? 1 : 0) {
  const calls = [];
  return {
    calls,
    user: {
      async findUnique() {
        return existingUser;
      },
      async count() {
        return count;
      },
      async update(input) {
        calls.push({ operation: "update", input });
        return { ...existingUser, ...input.data };
      },
      async upsert(input) {
        calls.push({ operation: "upsert", input });
        return { id: "new-user", ...input.create };
      },
    },
  };
}

test("OAuth sign-in cannot reactivate an existing disabled admin", async () => {
  const existingUser = {
    id: "disabled-admin",
    email: "admin@example.com",
    name: "Existing Admin",
    role: "ADMIN",
    status: "DISABLED",
  };
  const database = makeDatabase(existingUser);

  const result = await upsertAuthenticatedUser(
    { email: "ADMIN@example.com", name: "Provider Name" },
    {
      database,
      adminEmails: new Set(["admin@example.com"]),
      allowFirstUserAdmin: () => true,
      now: () => new Date("2026-08-03T10:00:00.000Z"),
    }
  );

  assert.equal(result.status, "DISABLED");
  assert.equal(result.role, "ADMIN");
  assert.deepEqual(Object.keys(database.calls[0].input.data).sort(), ["lastSeenAt", "name"]);
});

test("admin allowlist provisions a new user as an active admin", async () => {
  const database = makeDatabase();

  const result = await upsertAuthenticatedUser(
    { email: "Admin@Example.com", name: "New Admin" },
    {
      database,
      adminEmails: new Set(["admin@example.com"]),
      allowFirstUserAdmin: () => false,
    }
  );

  assert.equal(result.email, "admin@example.com");
  assert.equal(result.role, "ADMIN");
  assert.equal(result.status, "ACTIVE");
});

test("a new non-admin user remains pending", async () => {
  const database = makeDatabase(null, 3);

  const result = await upsertAuthenticatedUser(
    { email: "user@example.com", name: "New User" },
    { database, adminEmails: new Set(), allowFirstUserAdmin: () => false }
  );

  assert.equal(result.role, "USER");
  assert.equal(result.status, "PENDING");
});
