import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  __setSkillStorageTestHooks,
  createSkill,
  findSimilarSkills,
  listSkillVersions,
  loadFile,
  restoreSkillVersion,
  saveFile,
} from "../lib/skillStorage.js";
import {
  __setSkillChangeRequestTestHooks,
  approveSkillChangeRequest,
  createSkillChangeRequest,
} from "../lib/skillChangeRequests.js";

const repoRoot = path.resolve(process.cwd(), "..");
const skillsRoot = path.join(repoRoot, "skills");

function makeFakeUserDb() {
  return {
    user: {
      async upsert({ where }) {
        return { id: where.id, email: `${where.id}@local.conductor` };
      },
      async findUnique({ where }) {
        return { id: where.id, email: `${where.id}@local.conductor`, name: "Flow Tester", role: "ADMIN" };
      },
    },
  };
}

function makeSkillChangeRequestDb() {
  const requests = new Map();

  return {
    skillChangeRequest: {
      async create({ data }) {
        const record = {
          id: `request-${requests.size + 1}`,
          status: "PENDING",
          reviewedById: null,
          reviewedAt: null,
          rejectionReason: null,
          result: null,
          createdAt: new Date("2026-07-19T09:00:00.000Z"),
          updatedAt: new Date("2026-07-19T09:00:00.000Z"),
          ...data,
        };
        requests.set(record.id, record);
        return { ...record, requestedBy: { id: data.requestedById }, reviewedBy: null };
      },
      async findMany() {
        return Array.from(requests.values());
      },
      async findUnique({ where }) {
        return requests.get(where.id) || null;
      },
      async update({ where, data }) {
        const existing = requests.get(where.id);
        const updated = { ...existing, ...data, updatedAt: new Date("2026-07-19T09:30:00.000Z") };
        requests.set(where.id, updated);
        return {
          ...updated,
          requestedBy: { id: updated.requestedById },
          reviewedBy: updated.reviewedById ? { id: updated.reviewedById } : null,
        };
      },
    },
  };
}

function createFixtureSkill(skillName, description = "Test skill for workflow verification.") {
  const skillDir = path.join(skillsRoot, skillName);
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: ${description}\n---\n\n# ${skillName}\n\n${description}\n`,
    "utf-8"
  );
  fs.writeFileSync(path.join(skillDir, "references", "guide.md"), "# Guide\n\nFlow test reference.\n", "utf-8");
}

function cleanupSkill(skillName) {
  fs.rmSync(path.join(skillsRoot, skillName), { recursive: true, force: true });
  fs.rmSync(path.join(process.cwd(), "data", "skill-versions", skillName), { recursive: true, force: true });
}

test("wizard flow scaffolds a richer skill and duplicate flow flags near-matches", async () => {
  const baseSkillName = "test-skill-flow-duplicate-base";
  const newSkillName = "test-skill-flow-wizard";

  createFixtureSkill(
    baseSkillName,
    "Use this skill for release readiness, QA validation, rollback planning, and frontend regression checks."
  );

  __setSkillStorageTestHooks({
    db: makeFakeUserDb(),
    logAction: async () => ({ success: true }),
  });

  try {
    await createSkill(newSkillName, "Use this skill for AI release validation and regression planning.", "admin-user", {
      role: "senior release engineer",
      owner: "platform-team",
      reviewer: "qa-lead",
      qualityStatus: "reviewed",
      triggerDescription: "release readiness and rollback planning",
      tags: ["release", "qa"],
      starterReferences: [{ title: "rollback-guide", summary: "Rollback steps and validation checks." }],
    });

    const similarity = findSimilarSkills({
      skillName: "release-readiness-checker",
      description:
        "Use this skill for release readiness, QA validation, rollback planning, and frontend regression checks.",
      triggerDescription: "release readiness and rollback planning",
      tags: ["release", "qa"],
      starterReferences: [{ title: "rollback-guide", summary: "Rollback steps and validation checks." }],
    });

    assert.equal(fs.existsSync(path.join(skillsRoot, newSkillName, "SKILL.md")), true);
    assert.ok(similarity.topMatches.length >= 1);
    assert.ok(similarity.hasHighSimilarity || similarity.topMatches[0].score >= 0.38);
  } finally {
    __setSkillStorageTestHooks();
    cleanupSkill(baseSkillName);
    cleanupSkill(newSkillName);
  }
});

test("restore flow recovers an earlier SKILL.md version", async () => {
  const skillName = "test-skill-flow-restore";
  createFixtureSkill(skillName, "Original version.");

  __setSkillStorageTestHooks({
    db: makeFakeUserDb(),
    logAction: async () => ({ success: true }),
  });

  try {
    await saveFile(skillName, "SKILL.md", `---\nname: ${skillName}\ndescription: Version one\n---\n\n# One\n`, "admin-user");
    await saveFile(skillName, "SKILL.md", `---\nname: ${skillName}\ndescription: Version two\n---\n\n# Two\n`, "admin-user");

    const versions = listSkillVersions(skillName, "SKILL.md", 10);
    const originalLatest = loadFile(skillName, "SKILL.md");

    await restoreSkillVersion(skillName, "SKILL.md", versions[1].id, "admin-user");
    const restored = loadFile(skillName, "SKILL.md");

    assert.match(originalLatest, /Version two/);
    assert.match(restored, /Version one/);
  } finally {
    __setSkillStorageTestHooks();
    cleanupSkill(skillName);
  }
});

test("approval flow creates and approves a pending skill request", async () => {
  const skillName = "test-skill-flow-approval";
  const auditEntries = [];

  __setSkillStorageTestHooks({
    db: makeFakeUserDb(),
    logAction: async (entry) => {
      auditEntries.push(entry);
      return { success: true };
    },
  });
  __setSkillChangeRequestTestHooks({
    db: makeSkillChangeRequestDb(),
    logAction: async (entry) => {
      auditEntries.push(entry);
      return { success: true };
    },
  });

  try {
    const request = await createSkillChangeRequest("requester-1", {
      type: "SKILL_CREATE",
      skillName,
      description: "Use this skill for approval workflow verification.",
      role: "senior tester",
      owner: "qa-team",
      qualityStatus: "reviewed",
      tags: ["qa", "approval"],
    });

    const approved = await approveSkillChangeRequest(request.id, "admin-reviewer");

    assert.equal(approved.status, "APPROVED");
    assert.equal(fs.existsSync(path.join(skillsRoot, skillName, "SKILL.md")), true);
    assert.ok(auditEntries.some((entry) => entry.action === "skill-change:request"));
    assert.ok(auditEntries.some((entry) => entry.action === "skill-change:approve"));
  } finally {
    __setSkillStorageTestHooks();
    __setSkillChangeRequestTestHooks();
    cleanupSkill(skillName);
  }
});
