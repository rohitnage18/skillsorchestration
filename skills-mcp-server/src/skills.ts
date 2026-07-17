/**
 * Filesystem logic for discovering and reading skills from the SKILLS_PATH
 * directory. Kept separate from index.ts so the MCP-protocol wiring and the
 * actual "what is a skill" logic do not get tangled together.
 *
 * Expected directory shape (matches the skills already built for this project):
 *
 *   <SKILLS_PATH>/
 *     frontend/
 *       SKILL.md
 *       references/
 *         react.md
 *         vue.md
 *         ...
 *     backend/
 *       SKILL.md
 *       references/
 *         ...
 *     workflow/
 *       SKILL.md          (a skill with no references/ folder is valid too)
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const SKILL_FILE_NAME = "SKILL.md";
const REFERENCES_DIR_NAME = "references";
const STATE_FILE_NAME = "skill-state.json";

export class SkillNotFoundError extends Error {
  constructor(name: string, available: string[]) {
    const suggestion =
      available.length > 0
        ? ` Available skills: ${available.join(", ")}.`
        : " No skills were found at all - check that SKILLS_PATH points to the right folder.";
    super(`No skill named "${name}" was found.${suggestion}`);
    this.name = "SkillNotFoundError";
  }
}

export interface SkillSummary {
  name: string;
  description: string;
  referenceFiles: string[];
  tags: string[];
  qualityStatus: string;
  healthStatus: "passed" | "warning" | "failed";
}

function parseDescription(skillMdContent: string): string {
  const frontmatterMatch = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return "(no description found - this skill's SKILL.md is missing YAML frontmatter)";
  }

  const frontmatter = frontmatterMatch[1];
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (!descriptionMatch) {
    return "(no description field found in this skill's frontmatter)";
  }

  return descriptionMatch[1].trim();
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function discoverSkillNames(skillsPath: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(skillsPath, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `Could not read SKILLS_PATH directory "${skillsPath}". ` +
        `Check that the path exists and is readable. Underlying error: ${
          err instanceof Error ? err.message : String(err)
        }`
    );
  }

  const candidateDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);

  const namesWithSkillMd: string[] = [];
  for (const dirName of candidateDirs) {
    const skillMdPath = join(skillsPath, dirName, SKILL_FILE_NAME);
    if (await isFile(skillMdPath)) {
      namesWithSkillMd.push(dirName);
    }
  }

  return namesWithSkillMd.sort();
}

async function listReferenceFiles(skillsPath: string, skillName: string): Promise<string[]> {
  const referencesPath = join(skillsPath, skillName, REFERENCES_DIR_NAME);
  if (!(await isDirectory(referencesPath))) {
    return [];
  }

  const entries = await readdir(referencesPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
}

async function readSkillState(
  skillsPath: string,
  skillName: string
): Promise<{
  tags: string[];
  qualityStatus: string;
}> {
  const statePath = join(skillsPath, skillName, STATE_FILE_NAME);
  if (!(await isFile(statePath))) {
    return { tags: [], qualityStatus: "draft" };
  }

  try {
    const parsed = JSON.parse(await readFile(statePath, "utf-8"));
    return {
      tags: Array.isArray(parsed?.tags)
        ? parsed.tags.map((tag: unknown) => String(tag).trim().toLowerCase()).filter(Boolean)
        : [],
      qualityStatus:
        typeof parsed?.qualityStatus === "string" && parsed.qualityStatus.trim()
          ? parsed.qualityStatus.trim()
          : "draft",
    };
  } catch {
    return { tags: [], qualityStatus: "draft" };
  }
}

function inferTags(name: string, description: string, referenceFiles: string[], stateTags: string[]): string[] {
  const tags = new Set(stateTags);
  const combined = `${name} ${description} ${referenceFiles.join(" ")}`.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    frontend: ["frontend", "react", "vue", "svelte", "angular", "next", "tailwind"],
    backend: ["backend", "node", "python", "go", "java", "api", "database"],
    testing: ["test", "quality", "qa", "validation"],
    security: ["security", "auth", "authorization", "secret", "owasp", "vulnerability", "hardening"],
    delivery: ["delivery", "ci", "cd", "pipeline", "deploy"],
    architecture: ["architecture", "adr", "c4", "nfr"],
    sre: ["sre", "incident", "observability", "slo"],
  };

  for (const [tag, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((keyword) => combined.includes(keyword))) {
      tags.add(tag);
    }
  }

  return Array.from(tags).sort();
}

function evaluateHealth(description: string, referenceFiles: string[]): "passed" | "warning" | "failed" {
  if (!description || description.startsWith("(no description")) {
    return "failed";
  }
  if (referenceFiles.length === 0) {
    return "warning";
  }
  return "passed";
}

export async function listSkills(skillsPath: string): Promise<SkillSummary[]> {
  const names = await discoverSkillNames(skillsPath);

  const summaries: SkillSummary[] = [];
  for (const name of names) {
    const skillMdPath = join(skillsPath, name, SKILL_FILE_NAME);
    const content = await readFile(skillMdPath, "utf-8");
    const referenceFiles = await listReferenceFiles(skillsPath, name);
    const state = await readSkillState(skillsPath, name);
    const description = parseDescription(content);

    summaries.push({
      name,
      description,
      referenceFiles,
      tags: inferTags(name, description, referenceFiles, state.tags),
      qualityStatus: state.qualityStatus,
      healthStatus: evaluateHealth(description, referenceFiles),
    });
  }

  return summaries;
}

export async function getSkill(skillsPath: string, skillName: string): Promise<string> {
  const skillDir = join(skillsPath, skillName);
  const skillMdPath = join(skillDir, SKILL_FILE_NAME);

  if (!(await isFile(skillMdPath))) {
    const available = await discoverSkillNames(skillsPath);
    throw new SkillNotFoundError(skillName, available);
  }

  const sections: string[] = [];

  const routerContent = await readFile(skillMdPath, "utf-8");
  sections.push(`--- ${skillName}/SKILL.md ---\n\n${routerContent.trim()}`);

  const referenceFiles = await listReferenceFiles(skillsPath, skillName);
  for (const fileName of referenceFiles) {
    const filePath = join(skillDir, REFERENCES_DIR_NAME, fileName);
    const fileContent = await readFile(filePath, "utf-8");
    sections.push(`--- ${skillName}/${REFERENCES_DIR_NAME}/${fileName} ---\n\n${fileContent.trim()}`);
  }

  return sections.join("\n\n");
}
