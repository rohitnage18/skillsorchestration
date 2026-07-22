import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { errorResponse } from "../lib/http.ts";

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
