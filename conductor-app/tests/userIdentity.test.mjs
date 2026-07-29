import test from "node:test";
import assert from "node:assert/strict";

import { resolveExternalEventUser } from "../lib/userIdentity.js";

const activeUser = {
  id: "user-1",
  email: "user@example.com",
  externalUserId: "external-user-1",
  name: "Admin-managed name",
  status: "ACTIVE",
};

function createDatabase({ user = activeUser, updateCount = 1 } = {}) {
  const calls = {
    findUnique: [],
    updateMany: [],
  };
  return {
    calls,
    user: {
      async findUnique(args) {
        calls.findUnique.push(args);
        return user;
      },
      async updateMany(args) {
        calls.updateMany.push(args);
        return { count: updateCount };
      },
    },
  };
}

test("accepts an exact admin-bound active identity and updates only lastSeenAt", async () => {
  const database = createDatabase();
  const seenAt = new Date("2026-07-29T10:00:00.000Z");

  const result = await resolveExternalEventUser(
    {
      externalUserId: activeUser.externalUserId,
      email: "USER@example.com",
      name: "Attacker-controlled replacement",
    },
    { database, now: () => seenAt }
  );

  assert.equal(result.id, activeUser.id);
  assert.equal(result.name, activeUser.name);
  assert.deepEqual(database.calls.findUnique, [
    { where: { externalUserId: activeUser.externalUserId } },
  ]);
  assert.deepEqual(database.calls.updateMany, [
    {
      where: {
        id: activeUser.id,
        email: activeUser.email,
        externalUserId: activeUser.externalUserId,
        status: "ACTIVE",
      },
      data: { lastSeenAt: seenAt },
    },
  ]);
});

test("rejects email fallback so a client cannot bind an unassigned external id", async () => {
  const database = createDatabase({ user: null });

  await assert.rejects(
    resolveExternalEventUser(
      {
        externalUserId: "attacker-selected-id",
        email: activeUser.email,
      },
      { database }
    ),
    (error) => error.status === 403 && /configured by an administrator/.test(error.message)
  );

  assert.equal(database.calls.updateMany.length, 0);
});

test("rejects a mismatched email without rewriting the bound user", async () => {
  const database = createDatabase();

  await assert.rejects(
    resolveExternalEventUser(
      {
        externalUserId: activeUser.externalUserId,
        email: "attacker@example.com",
      },
      { database }
    ),
    (error) => error.status === 403 && /configured by an administrator/.test(error.message)
  );

  assert.equal(database.calls.updateMany.length, 0);
});

test("rejects inactive users without changing identity fields", async () => {
  const database = createDatabase({
    user: { ...activeUser, status: "DISABLED" },
  });

  await assert.rejects(
    resolveExternalEventUser(
      {
        externalUserId: activeUser.externalUserId,
        email: activeUser.email,
      },
      { database }
    ),
    (error) => error.status === 403
  );

  assert.equal(database.calls.updateMany.length, 0);
});

test("rejects a concurrent identity or status change", async () => {
  const database = createDatabase({ updateCount: 0 });

  await assert.rejects(
    resolveExternalEventUser(
      {
        externalUserId: activeUser.externalUserId,
        email: activeUser.email,
      },
      { database }
    ),
    (error) => error.status === 403
  );

  assert.equal(database.calls.updateMany.length, 1);
});
