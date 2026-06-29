<<<<<<< HEAD
# Skill Orchestration

A personal, multi-domain skills library, plus the tooling that serves it to AI coding
assistants — and the shared-context system that keeps multiple people's AI-assisted work
on the same project consistent with each other.

## Layout

```
.
├── skills/                          ← all skill domains (frontend, backend, sre, ...)
├── skills-mcp-server/                ← MCP server exposing skills as tools
├── skills-vscode-extension/          ← VS Code sidebar for browsing/inserting skills
├── .vscode/mcp.json                  ← wires the MCP server into VS Code's Copilot Agent mode
├── .github/copilot-instructions.md   ← tells Copilot to read PROJECT_CONTEXT.md first
├── CLAUDE.md                         ← tells Claude Code to read PROJECT_CONTEXT.md first
└── PROJECT_CONTEXT.md                ← the shared, human-maintained source of truth
```

## How this solves "two people, one project, no repeated context"

When you clone this repo, three things travel with it automatically — no setup
conversation needed with whoever you're working with:

1. **`.vscode/mcp.json`** wires up the skills MCP server for you the moment you open the
   folder in VS Code (uses `${workspaceFolder}`, so it works regardless of where the repo
   is cloned to, on anyone's machine).
2. **`.github/copilot-instructions.md`** and **`CLAUDE.md`** both point any AI assistant
   working in this repo at `PROJECT_CONTEXT.md` first, before anything else.
3. **`PROJECT_CONTEXT.md`** is the actual shared source of truth: the API contract
   between frontend and backend, architectural decisions already made, and current
   status. Both people update it as they work. Neither person re-explains the project
   to their AI assistant from scratch — it's already loaded, every session, for free.

This is deliberately *not* a tool that watches your code and tries to auto-generate this
context — see the discussion in this project's history for why that's a much harder and
less trustworthy approach. This is automation for *loading* context consistently, paired
with a lightweight document a human keeps accurate — which is the part automation can't
reliably do on its own.

## Setup

1. **MCP server**: `cd skills-mcp-server && npm install && npm run build`
2. **VS Code extension** (optional, for manual browsing): `cd skills-vscode-extension && npm install && npm run build`, then F5 or package as a `.vsix`
3. Open this repo's root folder in VS Code — `.vscode/mcp.json` will wire up automatically
4. Open Copilot Chat, switch to **Agent mode** — the `skills` server's tools
   (`list_skills`, `get_skill`) will be available, and Copilot will call them
   automatically when a request matches a skill's domain
5. Fill in `PROJECT_CONTEXT.md` for your actual project as you go

## Adding a new skill

Create a new folder under `skills/` with a `SKILL.md` (and an optional `references/`
folder) following the same pattern as the existing skills. No code changes are needed
anywhere else — the MCP server and the VS Code extension both discover skills by reading
the `skills/` folder at runtime.
=======
# skillsorchestration
>>>>>>> ab9cdc3f6c8b3bfd6aff8c5d8e7c1656378f3bde
