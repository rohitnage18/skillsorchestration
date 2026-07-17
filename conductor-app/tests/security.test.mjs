import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetRequestSecurityTestState,
  assertReplayWindow,
  enforceRateLimit,
} from "../lib/requestSecurity.js";
import {
  createSkillEventSignature,
  verifySkillEventSignature,
} from "../lib/productionSecurity.js";

test("enforceRateLimit allows requests within the configured window", () => {
  __resetRequestSecurityTestState();

  const first = enforceRateLimit({
    bucket: "test",
    key: "client-1",
    limit: 2,
    windowMs: 1_000,
    now: 1_000,
  });
  const second = enforceRateLimit({
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

test("enforceRateLimit blocks requests that exceed the configured window", () => {
  __resetRequestSecurityTestState();

  enforceRateLimit({
    bucket: "test",
    key: "client-2",
    limit: 1,
    windowMs: 1_000,
    now: 2_000,
  });

  assert.throws(
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

test("assertReplayWindow rejects repeated external event ids inside the replay window", () => {
  __resetRequestSecurityTestState();

  assert.doesNotThrow(() =>
    assertReplayWindow({
      bucket: "events",
      key: "evt-1",
      ttlMs: 60_000,
      now: 5_000,
    })
  );

  assert.throws(
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
