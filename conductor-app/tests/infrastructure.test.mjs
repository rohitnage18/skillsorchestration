import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { errorResponse, getRouteErrorStatus } from "../lib/http.ts";

test("secure Nodemailer alias exposes the SMTP transport API", async () => {
  const { default: nodemailer } = await import("secure-nodemailer");
  const transport = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
  });

  assert.equal(typeof transport.sendMail, "function");
  transport.close();
});

test("errorResponse hides server errors and logs details server-side", async () => {
  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  try {
    const response = errorResponse(
      new Error("database password and internal stack details"),
      "Unable to complete the request.",
      500
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Unable to complete the request." });
    assert.equal(logged.length, 1);
    assert.match(String(logged[0][1]), /database password/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("errorResponse returns a stable message for Zod validation failures", async () => {
  let validationError;
  try {
    z.object({ skillName: z.string().min(1) }).parse({ skillName: 42 });
  } catch (error) {
    validationError = error;
  }

  const response = errorResponse(validationError, "Invalid event.", 400);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid request data." });
});

test("errorResponse preserves intentional client-facing 4xx messages", async () => {
  const response = errorResponse(new Error("Login is required."), "Request failed.", 401);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Login is required." });
});

test("route error classification exposes only validation and explicit HTTP errors", () => {
  assert.equal(getRouteErrorStatus(new Error("database connection details")), 500);
  assert.equal(getRouteErrorStatus(new SyntaxError("invalid JSON")), 400);
  assert.equal(
    getRouteErrorStatus(Object.assign(new Error("Skill not found."), { status: 404 })),
    404
  );
});

test("database-backed API routes do not return raw exception messages", () => {
  const routePaths = [
    "app/api/users/route.ts",
    "app/api/notifications/route.ts",
    "app/api/notifications/unread-count/route.ts",
    "app/api/audit-logs/route.ts",
    "app/api/audit-logs/stats/route.ts",
    "app/api/skill-change-requests/route.ts",
    "app/api/skill-change-requests/[requestId]/approve/route.ts",
    "app/api/skill-change-requests/[requestId]/reject/route.ts",
  ];

  for (const routePath of routePaths) {
    const source = fs.readFileSync(path.join(process.cwd(), routePath), "utf-8");
    assert.doesNotMatch(
      source,
      /error\s+instanceof\s+Error\s*\?\s*error\.message/,
      `${routePath} must sanitize unexpected server errors.`
    );
  }
});

test("browser CI starts Conductor explicitly and preserves startup diagnostics", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), "../.github/workflows/browser-e2e.yml"),
    "utf-8"
  );
  const playwrightConfig = fs.readFileSync(
    path.join(process.cwd(), "playwright.config.ts"),
    "utf-8"
  );

  assert.match(workflow, /name: Prepare E2E database/);
  assert.match(workflow, /name: Start Conductor and wait for readiness/);
  assert.match(workflow, /curl .*http:\/\/127\.0\.0\.1:3100\/login/);
  assert.match(workflow, /conductor-e2e-server\.log/);
  assert.match(workflow, /PLAYWRIGHT_EXTERNAL_SERVER: "true"/);
  assert.match(playwrightConfig, /usesExternalWebServer\s*\?\s*undefined/);
});
