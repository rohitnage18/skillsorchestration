import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  __setSkillStorageTestHooks,
  createSkill,
  loadSkill,
  loadSkillState,
  importSkill,
  loadLatestSkillQaReport,
  saveFile,
  saveSkillQaReport,
  validateSkill,
  listSkills,
  getSkillInsights,
} from "../lib/skillStorage.js";
import {
  __setRegistryServiceTestHooks,
  executeRegistrySkill,
} from "../features/skills/service.ts";

const repoRoot = path.resolve(process.cwd(), "..");
const skillsRoot = path.join(repoRoot, "skills");
const importedRoot = path.join(process.cwd(), "imported-workspaces");

function makeFakeDb() {
  return {
    user: {
      async upsert({ where }) {
        return { id: where.id, email: `${where.id}@local.conductor` };
      },
      async findUnique({ where }) {
        return { id: where.id, email: `${where.id}@local.conductor`, name: "Test User", role: "ADMIN" };
      },
    },
  };
}

function createSkillFixture(skillName) {
  const skillDir = path.join(skillsRoot, skillName);
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: Test skill\n---\n\n# ${skillName}\n`,
    "utf-8"
  );
  fs.writeFileSync(
    path.join(skillDir, "references", "guide.md"),
    "# Guide\n\nOriginal reference content.\n",
    "utf-8"
  );
  return skillDir;
}

function cleanupSkillFixture(skillName, importName) {
  fs.rmSync(path.join(skillsRoot, skillName), { recursive: true, force: true });
  if (importName) {
    fs.rmSync(path.join(importedRoot, importName), { recursive: true, force: true });
  }
  fs.rmSync(path.join(process.cwd(), "data", "skill-versions", skillName), { recursive: true, force: true });
}

test("filesystem skill import logs notification-ready audit data", async () => {
  const skillName = "test-skill-import-notify";
  const importName = "test-skill-imported-workspace";
  const logged = [];
  createSkillFixture(skillName);

  __setSkillStorageTestHooks({
    db: makeFakeDb(),
    logAction: async (entry) => {
      logged.push(entry);
      return { success: true };
    },
  });

  try {
    const destination = await importSkill(skillName, importName, "admin-user");
    assert.equal(destination, importName);
    assert.equal(fs.existsSync(path.join(importedRoot, importName, "CONTEXT.md")), true);
  } finally {
    __setSkillStorageTestHooks();
    cleanupSkillFixture(skillName, importName);
  }

  assert.equal(logged.length, 1);
  assert.equal(logged[0].action, "skill:import");
  assert.equal(logged[0].resource, "skill");
  assert.equal(logged[0].metadata.skillName, skillName);
  assert.equal(logged[0].metadata.importedTo, importName);
});

test("skill creation scaffolds wizard metadata and starter references", async () => {
  const skillName = "test-skill-wizard-create";
  const logged = [];

  __setSkillStorageTestHooks({
    db: makeFakeDb(),
    logAction: async (entry) => {
      logged.push(entry);
      return { success: true };
    },
  });

  try {
    const created = await createSkill(skillName, "Use this skill for AI release checks.", "admin-user", {
      role: "AI release engineer",
      owner: "platform-team",
      reviewer: "qa-lead",
      qualityStatus: "reviewed",
      triggerDescription: "release readiness, model deployment, rollback planning",
      tags: ["ai", "delivery"],
      starterReferences: [
        { title: "deployment-and-rollback", summary: "Deployment safety checks." },
        { title: "evaluation-and-monitoring", summary: "Evaluation and monitoring expectations." },
      ],
    });

    const loaded = loadSkill(skillName);
    const state = loadSkillState(skillName);

    assert.equal(created, skillName);
    assert.match(loaded.skill, /Act as a senior AI release engineer\./);
    assert.match(loaded.skill, /Trigger this skill when requests match: release readiness, model deployment, rollback planning\./);
    assert.equal(loaded.references.length, 2);
    assert.ok(loaded.references.some((reference) => reference.name === "deployment-and-rollback.md"));
    assert.ok(loaded.references.some((reference) => reference.name === "evaluation-and-monitoring.md"));
    assert.deepEqual(state.tags, ["ai", "delivery"]);
    assert.equal(state.owner, "platform-team");
    assert.equal(state.reviewer, "qa-lead");
    assert.equal(state.qualityStatus, "reviewed");
  } finally {
    __setSkillStorageTestHooks();
    cleanupSkillFixture(skillName);
  }

  assert.equal(logged.length, 1);
  assert.equal(logged[0].action, "skill:create");
  assert.equal(logged[0].metadata.authoringMode, "wizard");
});

test("filesystem SKILL.md edits log skill:file:update with skill metadata", async () => {
  const skillName = "test-skill-file-update";
  const logged = [];
  createSkillFixture(skillName);

  __setSkillStorageTestHooks({
    db: makeFakeDb(),
    logAction: async (entry) => {
      logged.push(entry);
      return { success: true };
    },
  });

  try {
    await saveFile(skillName, "SKILL.md", `---\nname: ${skillName}\ndescription: Updated\n---\n\n# Updated\n`, "admin-user");
  } finally {
    __setSkillStorageTestHooks();
    cleanupSkillFixture(skillName);
  }

  assert.equal(logged.length, 1);
  assert.equal(logged[0].action, "skill:file:update");
  assert.equal(logged[0].metadata.filePath, "SKILL.md");
  assert.equal(logged[0].metadata.fileType, "skill");
  assert.equal(logged[0].metadata.versionAction, "update");
});

test("filesystem reference edits log skill:file:update with reference metadata", async () => {
  const skillName = "test-skill-reference-update";
  const logged = [];
  createSkillFixture(skillName);

  __setSkillStorageTestHooks({
    db: makeFakeDb(),
    logAction: async (entry) => {
      logged.push(entry);
      return { success: true };
    },
  });

  try {
    await saveFile(
      skillName,
      "references/guide.md",
      "# Guide\n\nUpdated reference content.\n",
      "admin-user"
    );
  } finally {
    __setSkillStorageTestHooks();
    cleanupSkillFixture(skillName);
  }

  assert.equal(logged.length, 1);
  assert.equal(logged[0].action, "skill:file:update");
  assert.equal(logged[0].metadata.filePath, "references/guide.md");
  assert.equal(logged[0].metadata.fileType, "reference");
  assert.equal(logged[0].metadata.skillName, skillName);
});

test("registry skill execution logs skill:execute for successful server function runs", async () => {
  const logged = [];
  const fakeDb = {
    user: {
      async upsert({ where }) {
        return { id: where.id, email: `${where.id}@local.conductor` };
      },
    },
    skill: {
      async findFirst() {
        return {
          id: "skill-123",
          name: "registry-test-skill",
          type: "SERVER_FUNCTION",
          functionKey: "test-fn",
        };
      },
    },
  };

  __setRegistryServiceTestHooks({
    db: fakeDb,
    logAction: async (entry) => {
      logged.push(entry);
      return { success: true };
    },
    runServerFunctionSkill: async (functionKey, input) => ({
      functionKey,
      input,
      ok: true,
    }),
  });

  try {
    const result = await executeRegistrySkill("admin-user", "skill-123", { hello: "world" });
    assert.equal(result.skillId, "skill-123");
    assert.deepEqual(result.output, {
      functionKey: "test-fn",
      input: { hello: "world" },
      ok: true,
    });
  } finally {
    __setRegistryServiceTestHooks();
  }

  assert.equal(logged.length, 1);
  assert.equal(logged[0].action, "skill:execute");
  assert.equal(logged[0].resource, "skill");
  assert.equal(logged[0].resourceId, "skill-123");
  assert.equal(logged[0].metadata.source, "registry");
});

test("skill validation reports warnings and inferred tags for documented skills", async () => {
  const skillName = "test-skill-validation";
  createSkillFixture(skillName);
  fs.writeFileSync(
    path.join(skillsRoot, skillName, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: Use this skill for frontend React quality validation, testing, and audit work on UI flows.\n---\n\n# ${skillName}\n\nUse this skill for frontend validation work. Read references/guide.md before using it, check important UI flows, and document the resulting quality findings for the team.\n`,
    "utf-8"
  );
  fs.writeFileSync(
    path.join(skillsRoot, skillName, "skill-state.json"),
    JSON.stringify(
      {
        qualityStatus: "reviewed",
        tags: ["custom-tag"],
        owner: "platform-team",
        reviewer: "qa-lead",
        lastAuditedAt: "2026-01-01T00:00:00.000Z",
      },
      null,
      2
    ),
    "utf-8"
  );

  try {
    const validation = validateSkill(skillName);
    const listed = listSkills();
    const record = listed.find((item) => item.name === skillName);
    const insights = getSkillInsights();

    assert.ok(["passed", "warning"].includes(validation.status));
    assert.ok(record);
    assert.equal(record.qualityStatus, "reviewed");
    assert.equal(record.owner, "platform-team");
    assert.equal(record.reviewer, "qa-lead");
    assert.equal(record.freshnessStatus, "stale");
    assert.ok(record.scorecard);
    assert.ok(["A", "B", "C", "D"].includes(record.scorecard.grade));
    assert.ok(["stable", "watch", "at-risk"].includes(record.scorecard.stability));
    assert.ok(record.tags.includes("frontend"));
    assert.ok(record.tags.includes("testing"));
    assert.ok(record.tags.includes("custom-tag"));
    assert.ok(validation.triggerValidation.matchedCount >= 1);
    assert.ok(insights.tagSummary.some((item) => item.tag === "frontend"));
    assert.ok(insights.ownerSummary.some((item) => item.owner === "platform-team"));
    assert.equal(insights.ownedSkills >= 1, true);
    assert.equal(insights.staleSkills >= 1, true);
    assert.equal(insights.stableSkills >= 0, true);
    assert.ok(Object.keys(insights.scoreGradeSummary).length >= 1);
    assert.ok(Object.keys(insights.stabilitySummary).length >= 1);
  } finally {
    cleanupSkillFixture(skillName);
  }
});

test("skill trigger validation warns when description does not match realistic prompts", async () => {
  const skillName = "test-skill-trigger-weak";
  createSkillFixture(skillName);
  fs.writeFileSync(
    path.join(skillsRoot, skillName, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: Misc helper object\n---\n\n# ${skillName}\n\nTiny body.\n`,
    "utf-8"
  );

  try {
    const validation = validateSkill(skillName);
    const triggerCheck = validation.checks.find((check) => check.label === "Prompt trigger coverage");

    assert.ok(triggerCheck);
    assert.ok(["warn", "fail"].includes(triggerCheck.status));
    assert.ok(validation.triggerValidation.matchedCount < validation.triggerValidation.promptCount);
  } finally {
    cleanupSkillFixture(skillName);
  }
});

test("skill QA report generation stores a reusable audit artifact", async () => {
  const skillName = "test-skill-qa-report";
  createSkillFixture(skillName);
  fs.writeFileSync(
    path.join(skillsRoot, skillName, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: Use this skill for security testing, delivery checks, auth review, and secret handling validation.\n---\n\n# ${skillName}\n\nUse this skill for security and testing work. Read references/guide.md before using it.\n`,
    "utf-8"
  );

  try {
    const validation = validateSkill(skillName);
    const report = saveSkillQaReport(skillName, validation);
    const loaded = loadLatestSkillQaReport(skillName);

    assert.ok(["Go", "Go with caution"].includes(report.recommendation));
    assert.ok(report.relativePath.includes("skill-qa-reports"));
    assert.ok(loaded);
    assert.equal(loaded.id, report.id);
    assert.match(loaded.content, /## release recommendation/);
  } finally {
    cleanupSkillFixture(skillName);
    fs.rmSync(path.join(process.cwd(), "data", "skill-qa-reports", skillName), { recursive: true, force: true });
  }
});
