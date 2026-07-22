import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatSkillInstallConfirmation, installSkillForClient } from "./install.js";

test("installs a skill into Codex and returns chat-visible confirmation", async () => {
  const root = await mkdtemp(join(tmpdir(), "skill-install-codex-"));
  const skillsPath = join(root, "library");
  const projectPath = join(root, "project");
  await mkdir(join(skillsPath, "backend", "references"), { recursive: true });
  await mkdir(projectPath, { recursive: true });
  await writeFile(
    join(skillsPath, "backend", "SKILL.md"),
    "---\nname: backend\ndescription: Backend guidance\n---\n",
    "utf-8"
  );
  await writeFile(join(skillsPath, "backend", "references", "node.md"), "# Node\n", "utf-8");

  try {
    const result = await installSkillForClient(skillsPath, projectPath, "backend", "codex");
    assert.equal(result.status, "imported");
    assert.equal(result.invocation, "$backend");
    assert.equal(
      await readFile(join(projectPath, ".agents", "skills", "backend", "references", "node.md"), "utf-8"),
      "# Node\n"
    );
    assert.match(formatSkillInstallConfirmation(result), /imported successfully for Codex/);

    const repeated = await installSkillForClient(skillsPath, projectPath, "backend", "codex");
    assert.equal(repeated.status, "already-installed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installs a skill into Claude Code's project skill directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "skill-install-claude-"));
  const skillsPath = join(root, "library");
  const projectPath = join(root, "project");
  await mkdir(join(skillsPath, "frontend"), { recursive: true });
  await mkdir(projectPath, { recursive: true });
  await writeFile(
    join(skillsPath, "frontend", "SKILL.md"),
    "---\nname: frontend\ndescription: Frontend guidance\n---\n",
    "utf-8"
  );

  try {
    const result = await installSkillForClient(skillsPath, projectPath, "frontend", "claude-code");
    assert.equal(result.status, "imported");
    assert.equal(result.invocation, "/frontend");
    assert.equal(
      await readFile(join(projectPath, ".claude", "skills", "frontend", "SKILL.md"), "utf-8"),
      "---\nname: frontend\ndescription: Frontend guidance\n---\n"
    );
    assert.match(formatSkillInstallConfirmation(result), /imported successfully for Claude Code/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
