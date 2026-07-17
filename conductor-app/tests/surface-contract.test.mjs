import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(process.cwd(), "..");
const skillsRoot = path.join(repoRoot, "skills");

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(repoRoot, relativePath)).href);
}

function isStableLibrarySkill(skillName) {
  return !String(skillName).startsWith("test-skill-");
}

async function listConductorSkillsStable(conductor) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return conductor.listSkills();
    } catch (error) {
      if (!String(error?.message || "").includes("Skill not found") || attempt === 4) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  return conductor.listSkills();
}

test("conductor, MCP server, and VS Code extension agree on discovered skill metadata", { concurrency: false }, async () => {
  const conductor = await import("../lib/skillStorage.js");
  const mcp = await importModule("skills-mcp-server/src/skills.ts");
  const extension = await importModule("skills-vscode-extension/src/skills.ts");

  const conductorSkills = await listConductorSkillsStable(conductor);
  const mcpSkills = await mcp.listSkills(skillsRoot);
  const extensionSkills = await extension.discoverSkills(skillsRoot);

  const conductorNames = conductorSkills.map((skill) => skill.name).filter(isStableLibrarySkill).sort();
  const mcpNames = mcpSkills.map((skill) => skill.name).filter(isStableLibrarySkill).sort();
  const extensionNames = extensionSkills.map((skill) => skill.name).filter(isStableLibrarySkill).sort();

  assert.deepEqual(mcpNames, conductorNames);
  assert.deepEqual(extensionNames, conductorNames);

  for (const skillName of conductorNames.slice(0, 8)) {
    const conductorSkill = conductorSkills.find((skill) => skill.name === skillName);
    const mcpSkill = mcpSkills.find((skill) => skill.name === skillName);
    const extensionSkill = extensionSkills.find((skill) => skill.name === skillName);

    assert.ok(conductorSkill);
    assert.ok(mcpSkill);
    assert.ok(extensionSkill);

    assert.equal(mcpSkill.description, conductorSkill.description);
    assert.equal(extensionSkill.description, conductorSkill.description);
    assert.equal(mcpSkill.qualityStatus, conductorSkill.qualityStatus);
    assert.equal(extensionSkill.qualityStatus, conductorSkill.qualityStatus);
    assert.equal(extensionSkill.healthStatus, mcpSkill.healthStatus);
    assert.ok(["passed", "warning", "failed"].includes(conductorSkill.healthStatus));
    assert.deepEqual(extensionSkill.tags, mcpSkill.tags);
    assert.ok(mcpSkill.tags.every((tag) => conductorSkill.tags.includes(tag)));
    assert.deepEqual(
      mcpSkill.referenceFiles,
      extensionSkill.referenceFiles.map((reference) => reference.name)
    );
  }
});

test("MCP server and VS Code extension return identical full skill content", { concurrency: false }, async () => {
  const mcp = await importModule("skills-mcp-server/src/skills.ts");
  const extension = await importModule("skills-vscode-extension/src/skills.ts");

  const extensionSkills = await extension.discoverSkills(skillsRoot);
  const sampleSkills = extensionSkills.slice(0, 5);

  assert.ok(sampleSkills.length > 0);

  for (const skill of sampleSkills) {
    const mcpContent = await mcp.getSkill(skillsRoot, skill.name);
    const extensionContent = await extension.getFullSkillContent(skill);
    assert.equal(extensionContent, mcpContent);
  }
});
