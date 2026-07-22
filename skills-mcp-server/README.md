# skills-mcp-server

An MCP server that serves your personal skills library (the `frontend`, `backend`, `sre`,
`business-analysis`, `system-architecture`, `project-management`, and any future domains
you add) to any MCP-compatible tool — Claude Code, Cursor, or Claude Desktop.

The skills themselves live as plain folders on disk, outside this package. This server
just reads them. That means **adding a new skill, or editing an existing one, never
requires rebuilding or republishing this server** — it just needs the right files to
exist on disk the next time a tool is called.

## Expected skills folder layout

```
skills/
├── frontend/
│   ├── SKILL.md
│   └── references/
│       ├── react.md
│       ├── vue.md
│       └── ...
├── backend/
│   ├── SKILL.md
│   └── references/
│       └── ...
└── workflow/
    └── SKILL.md          ← a skill with no references/ folder is also valid
```

A folder only counts as a skill if it directly contains a `SKILL.md` file. Anything else
in the `skills/` directory (stray folders, a `.git` directory, a skill still in progress
with no `SKILL.md` yet) is silently ignored rather than causing an error.

## Setup

### 1. Build the server

```bash
npm install
npm run build
```

This produces `build/index.js`, the compiled server entry point.

### 2. Point your MCP client at it

The server needs exactly one environment variable: `SKILLS_PATH`, set to the **absolute**
path of your `skills/` folder.

**Claude Code** — add to your MCP config (`~/.claude/mcp.json`, or via `claude mcp add`):

```json
{
  "mcpServers": {
    "skills": {
      "command": "node",
      "args": ["/absolute/path/to/skills-mcp-server/build/index.js"],
      "env": {
        "SKILLS_PATH": "/absolute/path/to/skills"
      }
    }
  }
}
```

**Cursor** — add the same shape to `.cursor/mcp.json` in your project (or the global
Cursor MCP settings):

```json
{
  "mcpServers": {
    "skills": {
      "command": "node",
      "args": ["/absolute/path/to/skills-mcp-server/build/index.js"],
      "env": {
        "SKILLS_PATH": "/absolute/path/to/skills"
      }
    }
  }
}
```

**Claude Desktop** — same configuration shape, in Claude Desktop's MCP server settings
(Settings → Developer → Edit Config).

Replace both absolute paths with the real locations on your machine. Restart the client
after editing its config so it picks up the new server.

## Tools this server exposes

### `list_skills`

No arguments. Returns every available skill: its name, its description (parsed from the
`description:` field in that skill's `SKILL.md` frontmatter), and the names of its
reference files, if any.

Important: "available" here means filesystem skills discovered under the configured
`SKILLS_PATH`. In this repository that is normally the local `skills/` folder, so
`list_skills` should return the skills your team created here, not any built-in assistant
or platform skills.

### `get_skill`

One argument, `name` — the exact skill name as returned by `list_skills` (e.g.
`"frontend"`). Returns the full content of that skill: its `SKILL.md` router, plus every
file in its `references/` folder, concatenated together with clear `--- path/to/file ---`
delimiters so it's always obvious which section came from which file.

If `name` doesn't match any skill, the tool returns a helpful error listing every skill
name that *is* available, rather than a bare "not found."

### `import_skill`

Arguments:

- `name`: exact skill name returned by `list_skills`
- `client`: `codex` or `claude-code`

Copies the complete skill directory into the active project configured by `PROJECT_PATH`:

- `codex` -> `<PROJECT_PATH>/.agents/skills/<name>`
- `claude-code` -> `<PROJECT_PATH>/.claude/skills/<name>`

The result explicitly confirms the import in chat and tells the user how to invoke it.
Existing destinations are reported as already installed and are never overwritten.
`PROJECT_PATH` is required.


## A note on get_skill's size

`get_skill` deliberately returns everything for a skill in one response — the router and
every reference file — rather than making the caller fetch reference files one at a time
with a second tool. This is simpler to use, at the cost of returning more content than is
always strictly needed (e.g. `frontend`'s React, Vue, Svelte, Angular, and vanilla
reference files all come back together, even if only one is relevant to the current
question). For a personal/local tool like this, that trade-off — simplicity over token
efficiency — is the right one; it can be revisited later if it ever becomes a real problem.

## Local testing without a client

## Optional conductor audit reporting

Set `CONDUCTOR_URL`, `MCP_USER_ID`, and `MCP_USER_EMAIL` in your MCP config to report
`list_skills` as `skill:list` and `get_skill` as `skill:read` to the conductor app.
When SMTP is configured and an admin user exists, `get_skill` creates audit logs,
notifications, and admin email. `list_skills` is stored in the database without email.

See `../docs/USERS_AND_SKILL_EVENTS.md` for the full user setup flow.

You can exercise the server directly by piping raw JSON-RPC requests into it:

```bash
SKILLS_PATH=/absolute/path/to/skills node build/index.js
```

Then on stdin, send (each on its own line):

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_skills","arguments":{}}}
```

## Development

```bash
npm run watch   # recompiles on every file change
npm start       # runs the already-built server (still needs SKILLS_PATH set)
```

## Why stdio, not HTTP

This server uses the stdio transport — the MCP client launches it as a local subprocess
and talks to it over stdin/stdout, rather than over a network port. This is the right
choice for a single-user, local tool like this one: no server process to keep running,
no port to manage, no auth to set up. It only becomes worth switching to the
Streamable HTTP transport if this server ever needs to be reached by more than one
machine or person at once — which isn't the case here.
