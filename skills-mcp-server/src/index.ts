#!/usr/bin/env node

/**
 * Skills MCP Server
 *
 * Tools:
 *   - list_skills: lists every available skill
 *   - get_skill: returns full content of one skill
 *   - read_context: reads CONTEXT.md from the active project (PROJECT_PATH)
 *   - update_context: rewrites sections + appends changelog entry
 *
 * Env vars:
 *   SKILLS_PATH  — required — path to skills/ folder
 *   PROJECT_PATH — optional — path to active project root
 *
 * IMPORTANT: never write to stdout — it corrupts the JSON-RPC stream.
 * Use console.error (stderr) for all logging.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listSkills, getSkill, SkillNotFoundError } from "./skills.js";
import {
  readContext,
  updateContext,
  requireProjectPath,
  ProjectPathNotConfiguredError,
  ContextFileNotFoundError,
} from "./context.js";

const SERVER_NAME = "skills-mcp-server";
const SERVER_VERSION = "1.1.0";

async function main(): Promise<void> {
  const skillsPath = process.env.SKILLS_PATH;

  if (!skillsPath) {
    console.error(
      `[${SERVER_NAME}] Missing required SKILLS_PATH environment variable. ` +
        `Set it to the absolute path of your skills/ folder in your MCP client config.`
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // ── Skill library tools ────────────────────────────────────────────────────

  server.registerTool(
    "list_skills",
    {
      title: "List available skills",
      description:
        "Lists every skill available in the skills library, including each skill's " +
        "name, its description (which explains what domain it covers and when to use " +
        "it), and the names of any reference files it has. Call this first to discover " +
        "what's available before calling get_skill.",
      inputSchema: {},
    },
    async () => {
      try {
        const skills = await listSkills(skillsPath);
        return {
          content: [{ type: "text", text: JSON.stringify(skills, null, 2) }],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_skill",
    {
      title: "Get a skill's full content",
      description:
        "Returns the full content of one named skill: its SKILL.md router file, " +
        "plus every file in its references/ folder (if any), concatenated together " +
        "and clearly delimited by file path. Use the exact skill name returned by " +
        "list_skills.",
      inputSchema: {
        name: z
          .string()
          .describe(
            "The exact skill name as returned by list_skills, e.g. 'frontend' or 'backend'."
          ),
      },
    },
    async ({ name }) => {
      try {
        const content = await getSkill(skillsPath, name);
        return { content: [{ type: "text", text: content }] };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  // ── Project context tools ──────────────────────────────────────────────────

  server.registerTool(
    "read_context",
    {
      title: "Read project context",
      description:
        "Reads the CONTEXT.md file from the active project folder (set via the " +
        "PROJECT_PATH environment variable in your MCP config). Returns the full " +
        "content of CONTEXT.md — the shared source of truth for the project's " +
        "current architecture, API contract, decisions, status, and history. " +
        "ALWAYS call this at the start of every session and before starting any task " +
        "in a project. Do not rely on conversation history instead of calling this — " +
        "another team member may have updated CONTEXT.md since your last session.",
      inputSchema: {},
    },
    async () => {
      try {
        const projectPath = requireProjectPath();
        const content = await readContext(projectPath);
        return { content: [{ type: "text", text: content }] };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "update_context",
    {
      title: "Update project context",
      description:
        "Updates CONTEXT.md in the active project folder. Does two things in one call: " +
        "(1) rewrites the named current-state sections you provide with fresh content, " +
        "and (2) appends a timestamped changelog entry recording what changed and why. " +
        "ALWAYS call this after completing any task that changes something meaningful " +
        "about the project — a new decision, a changed API contract, a shift in status, " +
        "a resolved blocker. You do not need to provide every section — only the ones " +
        "that actually changed. The changelog entry should be a plain-language summary " +
        "of what was done and any key decisions made.",
      inputSchema: {
        sections: z
          .record(z.string(), z.string())
          .describe(
            "An object mapping section names to their new content. " +
            "Section names must match the ## headings in CONTEXT.md exactly " +
            "(e.g. 'Stack', 'API contract', 'Current status', 'Open questions / blockers', " +
            "'Decisions log'). Only include sections that actually changed."
          ),
        changelog_entry: z
          .string()
          .min(10)
          .describe(
            "A plain-language description of what was done in this task and any " +
            "key decisions made. Will be timestamped and appended to the ## Changelog " +
            "section. Be specific enough that a teammate reading it later would know " +
            "what changed and why, without needing to read all the code."
          ),
      },
    },
    async ({ sections, changelog_entry }) => {
      try {
        const projectPath = requireProjectPath();
        await updateContext(projectPath, sections, changelog_entry);
        return {
          content: [
            {
              type: "text",
              text: `CONTEXT.md updated successfully in "${projectPath}". ` +
                    `Sections rewritten: ${Object.keys(sections).join(", ") || "none"}. ` +
                    `Changelog entry appended.`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const projectPath = process.env.PROJECT_PATH;
  console.error(
    `[${SERVER_NAME}] v${SERVER_VERSION} running on stdio. ` +
      `Skills: ${skillsPath} | Project: ${projectPath ?? "(not set — read_context/update_context unavailable)"}`
  );
}

/** Converts a thrown error into a well-formed MCP tool error result. */
function errorResult(err: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  const message =
    err instanceof SkillNotFoundError ||
    err instanceof ProjectPathNotConfiguredError ||
    err instanceof ContextFileNotFoundError
      ? err.message
      : err instanceof Error
        ? `Unexpected error: ${err.message}`
        : "Unexpected error.";
  console.error(`[${SERVER_NAME}] ${message}`);
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] Fatal error during startup:`, err);
  process.exit(1);
});
