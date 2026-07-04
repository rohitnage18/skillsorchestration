/**
 * context.ts
 *
 * Handles reading and writing CONTEXT.md in the active project folder
 * (pointed to by PROJECT_PATH env var). Kept separate from skills.ts
 * so the two concerns — skill library management and project context
 * management — don't get entangled.
 *
 * CONTEXT.md structure:
 *   - A set of named current-state sections (## Project overview,
 *     ## Stack, ## Architecture summary, ## API contract,
 *     ## Current status, ## Open questions / blockers, ## Decisions log)
 *   - A ## Changelog section at the end that only ever gets appended to
 *
 * update_context rewrites the current-state sections with fresh content
 * and appends a new timestamped entry to ## Changelog.
 * read_context returns the full file content as-is.
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const CONTEXT_FILENAME = "CONTEXT.md";
const CHANGELOG_HEADING = "## Changelog";

export class ProjectPathNotConfiguredError extends Error {
  constructor() {
    super(
      "PROJECT_PATH environment variable is not set. " +
        "Add it to your .vscode/mcp.json env block, pointing at the root " +
        "folder of the project you are currently working on."
    );
    this.name = "ProjectPathNotConfiguredError";
  }
}

export class ContextFileNotFoundError extends Error {
  constructor(projectPath: string) {
    super(
      `No CONTEXT.md found in "${projectPath}". ` +
        "Create one from the CONTEXT_TEMPLATE.md that ships with skills-mcp-server, " +
        "or ask the assistant to initialise a blank one for you."
    );
    this.name = "ContextFileNotFoundError";
  }
}

/** Validated project path — throws if PROJECT_PATH is not set. */
export function requireProjectPath(): string {
  const p = process.env.PROJECT_PATH;
  if (!p || !p.trim()) {
    throw new ProjectPathNotConfiguredError();
  }
  return p.trim();
}

/** Full path to CONTEXT.md in the given project folder. */
function contextFilePath(projectPath: string): string {
  return join(projectPath, CONTEXT_FILENAME);
}

/**
 * Returns the full content of CONTEXT.md.
 * Throws ContextFileNotFoundError if the file doesn't exist yet.
 */
export async function readContext(projectPath: string): Promise<string> {
  const filePath = contextFilePath(projectPath);
  try {
    await access(filePath);
  } catch {
    throw new ContextFileNotFoundError(projectPath);
  }
  return readFile(filePath, "utf-8");
}

/**
 * Updates CONTEXT.md:
 *   1. Rewrites the named current-state sections with the provided content.
 *   2. Appends a timestamped changelog entry.
 *
 * Sections not mentioned in `sections` are left exactly as they were.
 * The ## Changelog section is never touched by the section-rewrite logic —
 * it is only ever appended to.
 *
 * If CONTEXT.md doesn't exist yet, creates it from scratch with
 * the sections provided and an initial changelog entry.
 */
export async function updateContext(
  projectPath: string,
  sections: Record<string, string>,
  changelogEntry: string
): Promise<void> {
  const filePath = contextFilePath(projectPath);

  let existing: string;
  try {
    await access(filePath);
    existing = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist yet — start from a minimal scaffold
    existing = buildScaffold(sections);
  }

  const updated = rewriteSections(existing, sections);
  const withChangelog = appendChangelog(updated, changelogEntry);

  await writeFile(filePath, withChangelog, "utf-8");
}

/**
 * Rewrites named ## sections in the existing content.
 * Uses a simple heading-delimiter approach: finds "## <Section name>"
 * and replaces everything between it and the next ## heading (or EOF)
 * with the new content.
 *
 * Sections are matched case-insensitively on the heading name.
 * The ## Changelog section is explicitly excluded — it is append-only.
 */
function rewriteSections(
  existing: string,
  sections: Record<string, string>
): string {
  let result = existing;

  for (const [sectionName, newContent] of Object.entries(sections)) {
    if (sectionName.toLowerCase() === "changelog") {
      // Never rewrite the changelog via this path — only appendChangelog touches it
      continue;
    }

    // Build a regex that matches "## <sectionName>" through the next "## " or EOF
    const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sectionPattern = new RegExp(
      `(## ${escapedName}[^\n]*\n)([\\s\\S]*?)(?=\n## |\n---\n## |$)`,
      "i"
    );

    const trimmedContent = newContent.trim();
    const replacement = `$1\n${trimmedContent}\n`;

    if (sectionPattern.test(result)) {
      result = result.replace(sectionPattern, replacement);
    } else {
      // Section heading doesn't exist — append it before the Changelog section
      const changelogIndex = result.indexOf(`\n${CHANGELOG_HEADING}`);
      const newSection = `\n## ${sectionName}\n\n${trimmedContent}\n`;
      if (changelogIndex !== -1) {
        result =
          result.slice(0, changelogIndex) +
          newSection +
          result.slice(changelogIndex);
      } else {
        result += newSection;
      }
    }
  }

  return result;
}

/**
 * Appends a new dated entry to the ## Changelog section.
 * If no ## Changelog heading exists yet, adds one at the end.
 */
function appendChangelog(content: string, entry: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const logEntry = `\n### ${timestamp}\n\n${entry.trim()}\n`;

  const changelogIndex = content.indexOf(`\n${CHANGELOG_HEADING}`);
  if (changelogIndex === -1) {
    // No changelog section yet — add it
    return content.trimEnd() + `\n\n${CHANGELOG_HEADING}\n${logEntry}`;
  }

  // Append after the ## Changelog heading line
  const headingEnd = content.indexOf("\n", changelogIndex + 1);
  return (
    content.slice(0, headingEnd + 1) +
    logEntry +
    content.slice(headingEnd + 1)
  );
}

/**
 * Builds a minimal CONTEXT.md from scratch when the file doesn't exist.
 */
function buildScaffold(sections: Record<string, string>): string {
  const lines: string[] = [
    "# Project Context",
    "",
    "> This file is read and maintained automatically by the AI assistant.",
    "> Read it at the start of every session. Update it after every task.",
    "",
    "---",
    "",
  ];

  for (const [name, content] of Object.entries(sections)) {
    if (name.toLowerCase() === "changelog") continue;
    lines.push(`## ${name}`, "", content.trim(), "");
  }

  lines.push("---", "", CHANGELOG_HEADING, "");
  return lines.join("\n");
}
