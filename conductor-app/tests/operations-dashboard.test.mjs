import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createReleaseSnapshot,
  getImportedWorkspaceIntelligence,
  getRepositoryBranchHealth,
  getSkillDependencyGraph,
  listReleaseSnapshots,
  seedDemoWorkspaceData,
} from "../lib/operations.js";

const repoRoot = path.resolve(process.cwd(), "..");
const skillsRoot = path.join(repoRoot, "skills");
const importedRoot = path.join(process.cwd(), "imported-workspaces");
const snapshotsRoot = path.join(process.cwd(), "data", "release-snapshots");

function createSkillFixture(skillName, description, tags = []) {
  const skillDir = path.join(skillsRoot, skillName);
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: ${description}\n---\n\n# ${skillName}\n\n${description}\n`,
    "utf-8"
  );
  fs.writeFileSync(
    path.join(skillDir, "references", "shared-guide.md"),
    "# Shared guide\n\nRelease readiness and validation notes.\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(skillDir, "skill-state.json"),
    JSON.stringify(
      {
        tags,
        owner: "platform-team",
        reviewer: "qa-lead",
        qualityStatus: "reviewed",
      },
      null,
      2
    ),
    "utf-8"
  );
}

function cleanupPath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

test("dependency graph surfaces strong relationships between similar skills", () => {
  const leftSkill = "test-skill-graph-alpha";
  const rightSkill = "test-skill-graph-beta";

  createSkillFixture(
    leftSkill,
    "Use this skill for release readiness, rollout validation, rollback planning, and regression testing.",
    ["release", "qa", "frontend"]
  );
  createSkillFixture(
    rightSkill,
    "Use this skill for release readiness, rollout validation, rollback planning, and regression testing.",
    ["release", "qa", "frontend"]
  );

  try {
    const graph = getSkillDependencyGraph(10);
    const edge = graph.topEdges.find(
      (item) =>
        (item.source === leftSkill && item.target === rightSkill) ||
        (item.source === rightSkill && item.target === leftSkill)
    );

    assert.ok(graph.nodeCount >= 2);
    assert.ok(edge);
    assert.ok(edge.score >= 0.35);
    assert.ok(["related", "reused", "overlapping"].includes(edge.relationship));
  } finally {
    cleanupPath(path.join(skillsRoot, leftSkill));
    cleanupPath(path.join(skillsRoot, rightSkill));
  }
});

test("workspace intelligence reports freshness, risks, and recommendations", () => {
  const workspaceName = "test-workspace-intelligence";
  const linkedSkill = "test-skill-workspace-linked";
  const recommendedSkill = "test-skill-workspace-recommended";

  createSkillFixture(
    linkedSkill,
    "Use this skill for workspace approval flow validation and regression checks.",
    ["approval", "qa"]
  );
  createSkillFixture(
    recommendedSkill,
    "Use this skill for GitHub branch health checks, merge readiness, and release snapshots.",
    ["github", "release"]
  );
  fs.writeFileSync(
    path.join(skillsRoot, linkedSkill, "skill-state.json"),
    JSON.stringify(
      {
        tags: ["approval", "qa"],
        owner: "platform-team",
        reviewer: "qa-lead",
        qualityStatus: "draft",
        importedTo: workspaceName,
        importedAt: "2026-07-18T00:00:00.000Z",
      },
      null,
      2
    ),
    "utf-8"
  );
  fs.mkdirSync(path.join(importedRoot, workspaceName), { recursive: true });
  fs.writeFileSync(
    path.join(importedRoot, workspaceName, "CONTEXT.md"),
    "# Project Context\n\nGitHub branch health and release snapshot review are in progress.\n",
    "utf-8"
  );

  try {
    const intelligence = getImportedWorkspaceIntelligence(10);
    const workspace = intelligence.workspaces.find((item) => item.name === workspaceName);

    assert.ok(workspace);
    assert.ok(["low", "medium", "high"].includes(workspace.riskLevel));
    assert.ok(workspace.linkedSkills.some((item) => item.skillName === linkedSkill));
    assert.ok(workspace.recommendedSkills.some((item) => item.skillName === recommendedSkill));
  } finally {
    cleanupPath(path.join(importedRoot, workspaceName));
    cleanupPath(path.join(skillsRoot, linkedSkill));
    cleanupPath(path.join(skillsRoot, recommendedSkill));
  }
});

test("release snapshots and repository health produce stable operational metadata", () => {
  cleanupPath(snapshotsRoot);

  const snapshot = createReleaseSnapshot("Test release snapshot");
  const snapshots = listReleaseSnapshots(10);
  const repositoryHealth = getRepositoryBranchHealth();

  assert.equal(typeof snapshot.id, "string");
  assert.equal(snapshot.label, "Test release snapshot");
  assert.ok(snapshots.some((item) => item.id === snapshot.id));
  assert.equal(typeof repositoryHealth.branch, "string");
  assert.equal(Array.isArray(repositoryHealth.workflowFiles), true);
});

test("demo seed creates presentation workspaces and a baseline snapshot", () => {
  const firstDemo = path.join(importedRoot, "demo-commerce-suite");
  const secondDemo = path.join(importedRoot, "demo-ai-platform");

  cleanupPath(firstDemo);
  cleanupPath(secondDemo);

  const result = seedDemoWorkspaceData();

  try {
    assert.equal(fs.existsSync(path.join(firstDemo, "CONTEXT.md")), true);
    assert.equal(fs.existsSync(path.join(secondDemo, "CONTEXT.md")), true);
    assert.equal(typeof result.snapshotId, "string");
  } finally {
    cleanupPath(firstDemo);
    cleanupPath(secondDemo);
  }
});
