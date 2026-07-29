import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

import { verifySkillEventSignature } from "../../conductor-app/lib/productionSecurity.js";

const result = await build({
  entryPoints: [path.join(process.cwd(), "src", "skillEvents.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  write: false,
});
const compiledModule = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiledModule).toString("base64")}`;
const { buildSkillEventRequest } = await import(moduleUrl);

const event = {
  action: "skill:use",
  skillName: "security-engineering",
  metadata: { source: "test" },
};

test("builds a bearer-only request when HMAC is not configured", () => {
  const request = buildSkillEventRequest(event, {
    userId: "user-1",
    userEmail: "user@example.com",
    token: "event-token",
  });

  assert.equal(request.headers.authorization, "Bearer event-token");
  assert.equal(request.headers["x-skill-event-signature"], undefined);
});

test("signs the exact VS Code request body using the Conductor contract", () => {
  const timestamp = "1785300000000";
  const eventId = "vscode-event-123";
  const secret = "test-hmac-secret-1234567890";
  const request = buildSkillEventRequest(
    event,
    {
      userId: "user-1",
      userEmail: "user@example.com",
      token: "event-token",
      hmacSecret: secret,
    },
    timestamp,
    eventId
  );
  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.${request.body}`)
    .digest("hex");

  assert.equal(request.headers["x-skill-event-id"], eventId);
  assert.equal(request.headers["x-skill-event-timestamp"], timestamp);
  assert.equal(request.headers["x-skill-event-signature"], expectedSignature);
  assert.deepEqual(
    verifySkillEventSignature({
      timestamp: request.headers["x-skill-event-timestamp"],
      eventId: request.headers["x-skill-event-id"],
      signature: request.headers["x-skill-event-signature"],
      body: request.body,
      secret,
      now: Number(timestamp),
    }),
    {
      ok: true,
      reason: "ok",
      timestampMs: Number(timestamp),
    }
  );
});

test("extension wiring retrieves the HMAC secret and passes it to request signing", () => {
  const extensionSource = fs.readFileSync(
    path.join(process.cwd(), "src", "extension.ts"),
    "utf-8"
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
  );

  assert.match(extensionSource, /context\.secrets\.get\(EVENT_HMAC_SECRET_KEY\)/);
  assert.match(extensionSource, /buildSkillEventRequest\(event,[\s\S]*hmacSecret,/);
  assert.ok(
    manifest.contributes.commands.some(
      (command) => command.command === "skillsLibrary.setEventHmacSecret"
    )
  );
});
