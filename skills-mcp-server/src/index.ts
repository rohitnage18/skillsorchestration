#!/usr/bin/env node

/**
 * Skills MCP Server
 *
 * Exposes a local library of domain-specific SKILL.md files (frontend, backend,
 * sre, business-analysis, etc.) to any MCP-compatible client — Claude Code,
 * Cursor, Claude Desktop, or a custom integration.
 *
 * Tools:
 *   - list_skills: lists every available skill, its description, and which
 *     reference files it has.
 *   - get_skill: returns the full content of one skill (its SKILL.md router
 *     plus every file in its references/ folder, concatenated and clearly
 *     delimited).
 *
 * The skills themselves live on disk, outside this package, at the path given
 * by the SKILLS_PATH environment variable. This is deliberate: adding a new
 * skill, or editing an existing one, never requires rebuilding or republishing
 * this server — it just needs the files to exist at SKILLS_PATH the next time
 * a tool is called.
 *
 * IMPORTANT: this server speaks MCP over stdio. Never write to stdout outside
 * the SDK's own protocol messages — that would corrupt the JSON-RPC stream.
 * All logging in this file deliberately uses console.error (stderr) for
 * exactly this reason.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listSkills, getSkill, SkillNotFoundError } from "./skills.js";

const SERVER_NAME = "skills-mcp-server";
const SERVER_VERSION = "1.0.0";

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
          content: [
            {
              type: "text",
              text: JSON.stringify(skills, null, 2),
            },
          ],
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
        return {
          content: [
            {
              type: "text",
              text: content,
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

  console.error(`[${SERVER_NAME}] running on stdio, serving skills from ${skillsPath}`);
}

/** Converts a thrown error into a well-formed MCP tool error result rather than crashing the server. */
function errorResult(err: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  const message =
    err instanceof SkillNotFoundError
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
