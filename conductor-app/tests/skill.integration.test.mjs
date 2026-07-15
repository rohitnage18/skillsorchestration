import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  __setSkillStorageTestHooks,
  importSkill,
  saveFile,
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
