import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  assertSkillFileContent,
  normalizeEditableSkillPath,
  normalizeSkillNameInput,
  sanitizeDescription,
  sanitizeText,
} from "./inputSafety.js";

const SKILLS_ROOT = path.join(process.cwd(), "..", "skills");
const IMPORT_ROOT = path.join(process.cwd(), "imported-workspaces");
const STATE_FILENAME = "skill-state.json";

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  const relative = path.relative(path.resolve(base), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function normalizeSkillName(name) {
  return normalizeSkillNameInput(name);
}

function hashContent(content) {
  return crypto.createHash("sha256").update(String(content)).digest("hex");
}

function getFileType(relativePath) {
  return relativePath === "SKILL.md" ? "skill" : relativePath.startsWith("references/") ? "reference" : "other";
}

function assertEditableSkillFile(relativePath) {
  return normalizeEditableSkillPath(relativePath);
}

function loadSkillState(skillName) {
  const skillDir = getSkillDirectory(skillName);
  const stateFile = path.join(skillDir, STATE_FILENAME);
  if (!fs.existsSync(stateFile)) {
    return { importedTo: null, importedAt: null };
  }

  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  } catch {
    return { importedTo: null, importedAt: null };
  }
}

function saveSkillState(skillName, state) {
  const skillDir = ensureSkillExists(skillName);
  const stateFile = path.join(skillDir, STATE_FILENAME);
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");
}

function describeFromSkillFile(content) {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return "No description";
  }
  const descriptionMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
  return descriptionMatch ? descriptionMatch[1].trim() : "No description";
}

function listSkills(query = "", filter = "all") {
  const safeQuery = sanitizeText(query, 100, "Search query");
  const safeFilter = ["all", "imported", "pending"].includes(filter) ? filter : "all";
  const entries = fs.existsSync(SKILLS_ROOT)
    ? fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })
    : [];
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => {
      const skillDir = path.join(SKILLS_ROOT, entry.name);
      const skillMdPath = path.join(skillDir, "SKILL.md");
      const description = fs.existsSync(skillMdPath)
        ? describeFromSkillFile(fs.readFileSync(skillMdPath, "utf-8"))
        : "No description";
      const state = loadSkillState(entry.name);
      return {
        name: entry.name,
        description,
        importedTo: state.importedTo,
        importedAt: state.importedAt,
      };
    })
    .filter((skill) => {
      const term = safeQuery.trim().toLowerCase();
      const matchesSearch =
        !term ||
        skill.name.toLowerCase().includes(term) ||
        skill.description.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (safeFilter === "imported") {
        return !!skill.importedTo;
      }
      if (safeFilter === "pending") {
        return !skill.importedTo;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSkillDirectory(skillName) {
  const normalized = normalizeSkillName(skillName);
  return safeJoin(SKILLS_ROOT, normalized);
}

function ensureSkillExists(skillName) {
  const skillDir = getSkillDirectory(skillName);
  if (!fs.existsSync(skillDir)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  return skillDir;
}

async function createSkill(skillName, description, userId) {
  const normalized = normalizeSkillName(skillName);
  const safeDescription = sanitizeDescription(description);
  const skillDir = safeJoin(SKILLS_ROOT, normalized);
  if (fs.existsSync(skillDir)) {
    throw new Error(`A skill with this name already exists: ${normalized}`);
  }
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  const content = `---\nname: ${normalized}\ndescription: ${safeDescription}\n---\n\n# ${normalized}\n\nDescribe this skill here.\n`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");
  await logSkillActivity({
    userId,
    action: "skill:create",
    resourceId: normalized,
    changes: {
      before: null,
      after: { skillName: normalized, description: safeDescription },
    },
    metadata: { skillName: normalized, source: "conductor-ui" },
  });
  return normalized;
}

function listSkillFiles(skillName) {
  const skillDir = ensureSkillExists(skillName);
  const files = [];
  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillMdPath)) {
    files.push({ path: "SKILL.md", name: "SKILL.md", type: "skill" });
  }
  const referencesDir = path.join(skillDir, "references");
  if (fs.existsSync(referencesDir)) {
    const entries = fs.readdirSync(referencesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({ path: `references/${entry.name}`, name: entry.name, type: "reference" });
      }
    }
  }
  return files;
}

function loadSkill(skillName) {
  const skillDir = ensureSkillExists(skillName);
  const skillMdPath = path.join(skillDir, "SKILL.md");
  const referencesDir = path.join(skillDir, "references");
  const skillContent = fs.existsSync(skillMdPath) ? fs.readFileSync(skillMdPath, "utf-8") : "";
  const references = [];
  if (fs.existsSync(referencesDir)) {
    const entries = fs.readdirSync(referencesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        references.push({ name: entry.name, content: fs.readFileSync(path.join(referencesDir, entry.name), "utf-8") });
      }
    }
  }
  return { skill: skillContent, references };
}

function loadFile(skillName, relativePath) {
  const skillDir = ensureSkillExists(skillName);
  const editablePath = assertEditableSkillFile(relativePath);
  const file = safeJoin(skillDir, editablePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`File not found: ${editablePath}`);
  }
  return fs.readFileSync(file, "utf-8");
}

async function saveFile(skillName, relativePath, content, userId) {
  const editablePath = assertEditableSkillFile(relativePath);
  const safeContent = assertSkillFileContent(content);
  const skillDir = ensureSkillExists(skillName);
  const file = safeJoin(skillDir, editablePath);
  const directory = path.dirname(file);
  const directoryRelative = path.relative(skillDir, directory);
  if (directoryRelative.startsWith("..") || path.isAbsolute(directoryRelative)) {
    throw new Error("Cannot write outside of the skill folder.");
  }
  const previousContent = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(file, safeContent, "utf-8");
  await logSkillActivity({
    userId,
    action: "skill:file:update",
    resourceId: `${normalizeSkillName(skillName)}:${editablePath}`,
    changes: {
      before: {
        hash: hashContent(previousContent),
        bytes: Buffer.byteLength(previousContent, "utf-8"),
      },
      after: {
        hash: hashContent(safeContent),
        bytes: Buffer.byteLength(safeContent, "utf-8"),
      },
    },
    metadata: {
      skillName: normalizeSkillName(skillName),
      filePath: editablePath,
      fileType: getFileType(editablePath),
      source: "conductor-ui",
    },
  });
}

function ensureProjectContextFile(projectDir, projectName) {
  const contextPath = path.join(projectDir, "CONTEXT.md");
  if (fs.existsSync(contextPath)) {
    return contextPath;
  }

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const content = `# Project Context

> This file is maintained automatically for the imported project.
> Read it at the start of each work session and update it as work progresses.

## Project overview

${projectName} is an imported project folder in the skill orchestration workspace.

## Stack

- Skill orchestration workspace
- Prisma-backed persistence
- Next.js and Node.js tooling

## Current status

- Project imported and ready for review.

## Open questions / blockers

- None recorded yet.

## Decisions log

- Initial context scaffold created automatically.

## Changelog

### ${timestamp}

Initial context scaffold created for this project.
`;

  fs.writeFileSync(contextPath, content, "utf-8");
  return contextPath;
}

async function logSkillActivity({ userId, action, resourceId, changes, metadata }) {
  try {
    if (!userId) {
      throw new Error("Authenticated user id is required for skill activity logging.");
    }

    const { db } = await import("./db");
    const { logAction } = await import("../features/logging/server-functions");

    await db.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@local.conductor`,
      },
    });

    await logAction({
      userId,
      action,
      resource: "skill",
      resourceId,
      changes,
      metadata,
    });
  } catch (error) {
    console.error("Failed to log skill activity:", error);
  }
}

async function importSkill(skillName, importName, userId) {
  const skillDir = ensureSkillExists(skillName);
  const destinationName = normalizeSkillName(importName || skillName);
  const targetDir = safeJoin(IMPORT_ROOT, destinationName);
  if (fs.existsSync(targetDir)) {
    throw new Error(`Import destination already exists: ${destinationName}`);
  }
  fs.mkdirSync(IMPORT_ROOT, { recursive: true });
  fs.cpSync(skillDir, targetDir, { recursive: true });
  ensureProjectContextFile(targetDir, destinationName);
  saveSkillState(skillName, {
    importedTo: destinationName,
    importedAt: new Date().toISOString(),
  });
  await logSkillActivity({
    userId,
    action: "skill:import",
    resourceId: destinationName,
    changes: {
      before: { sourceSkillName: normalizeSkillName(skillName) },
      after: { importedTo: destinationName },
    },
    metadata: {
      skillName: normalizeSkillName(skillName),
      importedTo: destinationName,
      source: "conductor-ui",
    },
  });
  return destinationName;
}

export {
  listSkills,
  createSkill,
  getSkillDirectory,
  listSkillFiles,
  loadSkill,
  loadFile,
  saveFile,
  importSkill,
  loadSkillState,
  logSkillActivity,
};
