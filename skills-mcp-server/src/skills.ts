/**
 * Filesystem logic for discovering and reading skills from the SKILLS_PATH
 * directory. Kept separate from index.ts so the MCP-protocol wiring and the
 * actual "what is a skill" logic don't get tangled together.
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

export class SkillNotFoundError extends Error {
  constructor(name: string, available: string[]) {
    const suggestion =
      available.length > 0
        ? ` Available skills: ${available.join(", ")}.`
        : " No skills were found at all — check that SKILLS_PATH points to the right folder.";
    super(`No skill named "${name}" was found.${suggestion}`);
    this.name = "SkillNotFoundError";
  }
}

export interface SkillSummary {
  name: string;
  description: string;
  referenceFiles: string[];
}

/** Parses the `description:` field out of a SKILL.md file's YAML frontmatter. */
function parseDescription(skillMdContent: string): string {
  const frontmatterMatch = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return "(no description found — this skill's SKILL.md is missing YAML frontmatter)";
  }

  const frontmatter = frontmatterMatch[1];
  // description fields here are a single line, possibly long; this matches
  // from `description:` to the end of that line.
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (!descriptionMatch) {
    return "(no description field found in this skill's frontmatter)";
  }

  return descriptionMatch[1].trim();
}

/** Returns true if `path` is a directory; false (rather than throwing) if it doesn't exist. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/** Returns true if `path` is a readable file; false (rather than throwing) if it doesn't exist. */
async function isFile(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Lists the names of every direct subdirectory of skillsPath that contains a
 * SKILL.md file. Subdirectories without one (stray folders, work-in-progress
 * skills, .git, etc.) are silently skipped rather than causing an error —
 * the skills/ folder is allowed to contain things that aren't finished skills
 * yet without breaking discovery for everything else.
 */
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

/** Lists the .md files inside a skill's references/ folder, if it has one. Returns [] if not. */
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

/**
 * Lists every available skill: its name, description (parsed from its
 * SKILL.md frontmatter), and the names of its reference files.
 */
export async function listSkills(skillsPath: string): Promise<SkillSummary[]> {
  const names = await discoverSkillNames(skillsPath);

  const summaries: SkillSummary[] = [];
  for (const name of names) {
    const skillMdPath = join(skillsPath, name, SKILL_FILE_NAME);
    const content = await readFile(skillMdPath, "utf-8");
    const referenceFiles = await listReferenceFiles(skillsPath, name);

    summaries.push({
      name,
      description: parseDescription(content),
      referenceFiles,
    });
  }

  return summaries;
}

/**
 * Returns the full content of one skill: its SKILL.md, plus every file in
 * its references/ folder (if any), concatenated together with clear
 * `--- path/to/file ---` delimiters so a model reading the result can tell
 * exactly which section came from which file.
 */
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
    sections.push(
      `--- ${skillName}/${REFERENCES_DIR_NAME}/${fileName} ---\n\n${fileContent.trim()}`
    );
  }

  return sections.join("\n\n");
}
