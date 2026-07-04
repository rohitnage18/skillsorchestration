import fs from "fs";
import path from "path";

const SKILLS_ROOT = path.join(process.cwd(), "..", "skills");
const IMPORT_ROOT = path.join(process.cwd(), "imported-workspaces");
const STATE_FILENAME = "skill-state.json";

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function normalizeSkillName(name) {
  return name.trim().replace(/\s+/g, "-").toLowerCase();
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
      const term = query.trim().toLowerCase();
      const matchesSearch =
        !term ||
        skill.name.toLowerCase().includes(term) ||
        skill.description.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (filter === "imported") {
        return !!skill.importedTo;
      }
      if (filter === "pending") {
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

function createSkill(skillName, description) {
  if (!skillName || !skillName.trim()) {
    throw new Error("Skill name is required.");
  }
  const normalized = normalizeSkillName(skillName);
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new Error("Skill name may only contain letters, numbers, hyphens, and underscores.");
  }
  const skillDir = safeJoin(SKILLS_ROOT, normalized);
  if (fs.existsSync(skillDir)) {
    throw new Error(`A skill with this name already exists: ${normalized}`);
  }
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  const content = `---\nname: ${normalized}\ndescription: ${description || "New skill"}\n---\n\n# ${normalized}\n\nDescribe this skill here.\n`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");
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
  const file = safeJoin(skillDir, relativePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`File not found: ${relativePath}`);
  }
  return fs.readFileSync(file, "utf-8");
}

function saveFile(skillName, relativePath, content) {
  const skillDir = ensureSkillExists(skillName);
  const file = safeJoin(skillDir, relativePath);
  const directory = path.dirname(file);
  if (!directory.startsWith(skillDir)) {
    throw new Error("Cannot write outside of the skill folder.");
  }
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(file, String(content), "utf-8");
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

async function logImportActivity(sourceSkillName, destinationName, userId = "dev-user") {
  try {
    const { db } = await import("./db");

    await db.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@local.conductor`,
      },
    });

    const auditLog = await db.auditLog.create({
      data: {
        userId,
        action: "skill:import",
        resource: "skill",
        resourceId: destinationName,
        changes: {
          before: { sourceSkillName },
          after: { importedTo: destinationName },
        },
        metadata: {
          sourceSkillName,
          importedTo: destinationName,
        },
      },
    });

    const admins = await db.user.findMany({ where: { role: "ADMIN" } });
    if (admins.length > 0) {
      await Promise.all(
        admins.map((admin) =>
          db.notification.create({
            data: {
              userId: admin.id,
              title: "Skill Imported",
              message: `${sourceSkillName} was imported into ${destinationName}`,
              type: "USER_ACTION",
              auditLogId: auditLog.id,
            },
          })
        )
      );
    }
  } catch (error) {
    console.error("Failed to log skill import activity:", error);
  }
}

async function importSkill(skillName, importName) {
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
  await logImportActivity(skillName, destinationName);
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
};
