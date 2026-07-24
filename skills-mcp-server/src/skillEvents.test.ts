import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buildSkillEventRequest } from "./skillEvents.js";

const event = {
  action: "skill:read" as const,
  skillName: "backend",
  resourceId: "backend",
  metadata: { source: "test" },
};

test("builds a bearer-authenticated skill event request", () => {
  const request = buildSkillEventRequest(event, {
    userId: "user-1",
    userEmail: "user@example.com",
    userName: "User One",
    token: "event-token",
  });

  assert.equal(request.headers.authorization, "Bearer event-token");
  assert.equal(request.headers["x-user-id"], "user-1");
  assert.equal(request.headers["x-user-name"], "User One");
  assert.equal(request.headers["x-skill-event-signature"], undefined);
  assert.deepEqual(JSON.parse(request.body), {
    ...event,
    source: "skills-mcp-server",
  });
});

test("signs the exact transmitted body when an HMAC secret is configured", () => {
  const timestamp = "1784890000000";
  const eventId = "event-123";
  const secret = "test-hmac-secret";
  const request = buildSkillEventRequest(
    event,
    {
      userId: "user-1",
      userEmail: "user@example.com",
      hmacSecret: secret,
    },
    timestamp,
    eventId
  );
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.${request.body}`)
    .digest("hex");

  assert.equal(request.headers["x-skill-event-id"], eventId);
  assert.equal(request.headers["x-skill-event-timestamp"], timestamp);
  assert.equal(request.headers["x-skill-event-signature"], expected);
});
