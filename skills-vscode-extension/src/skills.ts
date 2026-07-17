/**
 * Filesystem logic for discovering and reading skills from the configured
 * skills folder. This deliberately mirrors skills.ts in skills-mcp-server -
 * same discovery rules, same "what counts as a skill" definition - so the
 * VS Code extension and the MCP server never disagree about what's available.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const SKILL_FILE_NAME = "SKILL.md";
const REFERENCES_DIR_NAME = "references";
const STATE_FILE_NAME = "skill-state.json";

export interface SkillInfo {
  name: string;
  description: string;
  tags: string[];
  qualityStatus: string;
  healthStatus: "passed" | "warning" | "failed";
  skillMdPath: string;
  referenceFiles: { name: string; path: string }[];
}

function parseDescription(skillMdContent: string): string {
  const frontmatterMatch = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return "(no description found in this skill's frontmatter)";
  }
  const descriptionMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
  return descriptionMatch ? descriptionMatch[1].trim() : "(no description field found)";
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

async function listReferenceFiles(
  skillsPath: string,
  skillName: string
): Promise<{ name: string; path: string }[]> {
  const referencesDir = path.join(skillsPath, skillName, REFERENCES_DIR_NAME);
  if (!(await isDirectory(referencesDir))) {
    return [];
  }
  const entries = await fs.readdir(referencesDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => ({ name: e.name, path: path.join(referencesDir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function readSkillState(skillsPath: string, skillName: string): Promise<{
  tags: string[];
  qualityStatus: string;
}> {
  const statePath = path.join(skillsPath, skillName, STATE_FILE_NAME);
  if (!(await isFile(statePath))) {
    return { tags: [], qualityStatus: "draft" };
  }

  try {
    const parsed = JSON.parse(await fs.readFile(statePath, "utf-8"));
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

function inferTags(
  name: string,
  description: string,
  referenceFiles: { name: string; path: string }[],
  stateTags: string[]
): string[] {
  const tags = new Set(stateTags);
  const combined = `${name} ${description} ${referenceFiles.map((file) => file.name).join(" ")}`.toLowerCase();
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

function evaluateHealth(
  description: string,
  referenceFiles: { name: string; path: string }[]
): "passed" | "warning" | "failed" {
  if (!description || description.startsWith("(no description")) {
    return "failed";
  }
  if (referenceFiles.length === 0) {
    return "warning";
  }
  return "passed";
}

export async function discoverSkills(skillsPath: string): Promise<SkillInfo[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(skillsPath, { withFileTypes: true });
  } catch (err) {
    throw new Error(
      `Could not read skills folder "${skillsPath}". ` +
        `Check Skills Library settings and confirm the path exists. ` +
        `(${err instanceof Error ? err.message : String(err)})`
    );
  }

  const candidateDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

  const skills: SkillInfo[] = [];
  for (const dir of candidateDirs) {
    const skillMdPath = path.join(skillsPath, dir.name, SKILL_FILE_NAME);
    if (!(await isFile(skillMdPath))) {
      continue;
    }
    const content = await fs.readFile(skillMdPath, "utf-8");
    const description = parseDescription(content);
    const referenceFiles = await listReferenceFiles(skillsPath, dir.name);
    const state = await readSkillState(skillsPath, dir.name);
    skills.push({
      name: dir.name,
      description,
      tags: inferTags(dir.name, description, referenceFiles, state.tags),
      qualityStatus: state.qualityStatus,
      healthStatus: evaluateHealth(description, referenceFiles),
      skillMdPath,
      referenceFiles,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getFullSkillContent(skill: SkillInfo): Promise<string> {
  const sections: string[] = [];

  const routerContent = await fs.readFile(skill.skillMdPath, "utf-8");
  sections.push(`--- ${skill.name}/SKILL.md ---\n\n${routerContent.trim()}`);

  for (const ref of skill.referenceFiles) {
    const refContent = await fs.readFile(ref.path, "utf-8");
    sections.push(`--- ${skill.name}/references/${ref.name} ---\n\n${refContent.trim()}`);
  }

  return sections.join("\n\n");
}
