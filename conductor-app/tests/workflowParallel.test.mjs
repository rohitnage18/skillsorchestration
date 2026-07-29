import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { settleParallelTasks } from "../features/workflows/parallelExecution.ts";

test("waits for a started sibling to finish before reporting a level failure", async () => {
  const trace = [];
  let releaseSibling;
  const siblingGate = new Promise((resolve) => {
    releaseSibling = resolve;
  });

  const execution = settleParallelTasks([
    async () => {
      trace.push("sibling-started");
      await siblingGate;
      trace.push("sibling-finished");
      return "sibling-output";
    },
    async () => {
      trace.push("node-failed");
      throw new Error("fast failure");
    },
  ]);

  let executionRejected = false;
  execution.catch(() => {
    executionRejected = true;
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(executionRejected, false);
  assert.deepEqual(trace, ["sibling-started", "node-failed"]);

  releaseSibling();
  await assert.rejects(execution, /fast failure/);
  assert.deepEqual(trace, ["sibling-started", "node-failed", "sibling-finished"]);
});

test("reports the first node failure deterministically after all siblings settle", async () => {
  const firstError = new Error("first node failed");
  const secondError = new Error("second node failed");

  await assert.rejects(
    settleParallelTasks([
      async () => {
        await new Promise((resolve) => setImmediate(resolve));
        throw firstError;
      },
      async () => {
        throw secondError;
      },
    ]),
    (error) => error === firstError
  );
});

test("returns successful sibling outputs in node order", async () => {
  const outputs = await settleParallelTasks([
    async () => "first",
    async () => "second",
  ]);

  assert.deepEqual(outputs, ["first", "second"]);
});

test("workflow failure atomically reconciles running nodes before the parent run", () => {
  const engineSource = fs.readFileSync(
    path.join(process.cwd(), "features", "workflows", "engine.ts"),
    "utf-8"
  );
  const transactionIndex = engineSource.indexOf("await db.$transaction([");
  const nodeReconciliationIndex = engineSource.indexOf("db.nodeRun.updateMany({", transactionIndex);
  const runFailureIndex = engineSource.indexOf("db.workflowRun.update({", transactionIndex);

  assert.notEqual(transactionIndex, -1);
  assert.ok(nodeReconciliationIndex > transactionIndex);
  assert.ok(runFailureIndex > nodeReconciliationIndex);
  assert.match(engineSource, /status: "RUNNING",[\s\S]*status: "FAILED"/);
});
