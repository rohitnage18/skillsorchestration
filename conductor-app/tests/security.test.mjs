import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  __resetRequestSecurityTestState,
  assertReplayWindow,
  claimDedupeWindow,
  enforceRateLimit,
} from "../lib/requestSecurity.js";
import {
  createSkillEventSignature,
  verifySkillEventSignature,
} from "../lib/productionSecurity.js";

test("skill event identity is validated before deduplication", () => {
  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app", "api", "skill-events", "route.ts"),
    "utf-8"
  );
  const identityResolutionIndex = routeSource.indexOf(
    "const resolvedUser = await resolveExternalEventUser"
  );
  const deduplicationIndex = routeSource.indexOf("if (NOISY_ACTIONS.has(input.action))");

  assert.notEqual(identityResolutionIndex, -1);
  assert.notEqual(deduplicationIndex, -1);
  assert.ok(
    identityResolutionIndex < deduplicationIndex,
    "Invalid identities must not populate or bypass the event deduplication window."
  );
});

test("enforceRateLimit allows requests within the configured window", async () => {
  await __resetRequestSecurityTestState();

  const first = await enforceRateLimit({
    bucket: "test",
    key: "client-1",
    limit: 2,
    windowMs: 1_000,
    now: 1_000,
  });
  const second = await enforceRateLimit({
    bucket: "test",
    key: "client-1",
    limit: 2,
    windowMs: 1_000,
    now: 1_100,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
});

test("enforceRateLimit blocks requests that exceed the configured window", async () => {
  await __resetRequestSecurityTestState();

  await enforceRateLimit({
    bucket: "test",
    key: "client-2",
    limit: 1,
    windowMs: 1_000,
    now: 2_000,
  });

  await assert.rejects(
    () =>
      enforceRateLimit({
        bucket: "test",
        key: "client-2",
        limit: 1,
        windowMs: 1_000,
        now: 2_100,
      }),
    /Too many requests/
  );
});

test("assertReplayWindow rejects repeated external event ids inside the replay window", async () => {
  await __resetRequestSecurityTestState();

  await assertReplayWindow({
    bucket: "events",
    key: "evt-1",
    ttlMs: 60_000,
    now: 5_000,
  });

  await assert.rejects(
    () =>
      assertReplayWindow({
        bucket: "events",
        key: "evt-1",
        ttlMs: 60_000,
        now: 5_500,
      }),
    /Replay detected/
  );
});

test("claimDedupeWindow shares the replay claim semantics", async () => {
  await __resetRequestSecurityTestState();

  assert.equal(
    await claimDedupeWindow({ bucket: "dedupe", key: "same-event", ttlMs: 500, now: 10_000 }),
    true
  );
  assert.equal(
    await claimDedupeWindow({ bucket: "dedupe", key: "same-event", ttlMs: 500, now: 10_100 }),
    false
  );
  assert.equal(
    await claimDedupeWindow({ bucket: "dedupe", key: "same-event", ttlMs: 500, now: 10_501 }),
    true
  );
});

test("verifySkillEventSignature accepts valid HMAC signed event payloads", () => {
  const body = JSON.stringify({ action: "skill:use", skillName: "frontend" });
  const timestamp = String(Date.now());
  const eventId = "evt-valid";
  const secret = "signed-event-secret-12345678901234567890";
  const signature = createSkillEventSignature({ timestamp, eventId, body, secret });

  const result = verifySkillEventSignature({
    timestamp,
    eventId,
    signature,
    body,
    secret,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "ok");
});

test("verifySkillEventSignature rejects tampered or stale payloads", () => {
  const body = JSON.stringify({ action: "skill:use", skillName: "frontend" });
  const timestamp = "1000";
  const eventId = "evt-stale";
  const secret = "signed-event-secret-12345678901234567890";
  const signature = createSkillEventSignature({ timestamp, eventId, body, secret });

  const staleResult = verifySkillEventSignature({
    timestamp,
    eventId,
    signature,
    body,
    secret,
    now: 1_000 + 6 * 60 * 1_000,
  });
  const tamperedResult = verifySkillEventSignature({
    timestamp: String(Date.now()),
    eventId,
    signature: `${signature}00`,
    body,
    secret,
    now: Date.now(),
  });

  assert.equal(staleResult.ok, false);
  assert.equal(staleResult.reason, "stale-timestamp");
  assert.equal(tamperedResult.ok, false);
  assert.equal(tamperedResult.reason, "signature-mismatch");
});
