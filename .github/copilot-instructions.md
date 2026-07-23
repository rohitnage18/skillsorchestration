# Repository custom instructions for GitHub Copilot

**Read `PROJECT_CONTEXT.md` at the repo root before doing anything else in this
repository.** It holds the architecture summary, the current frontend/backend API
contract, the decisions log, and current status. Treat it as the source of truth over
your own assumptions about this codebase — if something here conflicts with what you'd
otherwise infer from the code, `PROJECT_CONTEXT.md` wins, and the contradiction itself is
worth flagging to the person you're working with.

## What this repository is

A personal skills library plus the tooling that serves it: a `skills/` folder of
domain-specific `SKILL.md` files (frontend, backend, sre, business-analysis,
system-architecture, project-management, and more), an MCP server
(`skills-mcp-server/`) that exposes them as tools, and a VS Code extension
(`skills-vscode-extension/`) for browsing and inserting them manually.

## Tools available to you in this repo

An MCP server named `skills` is configured in `.vscode/mcp.json` and is available to you
in Agent mode. It exposes two tools:

- `list_skills` — lists every skill, its description, and its reference files.
- `get_skill` — given a skill name, returns that skill's full content (its router plus
  every reference file). **Call this whenever a request matches a skill's described
  domain** (frontend, backend, SRE, etc.) rather than relying solely on your own general
  knowledge of that domain — the skill content reflects specific, current (2026)
  practices and known issues that may not be in your training data.

After any meaningful code change, also call `get_skill` for `quality-engineering` and
use it as a default post-change validation pass. Treat it as the repository's senior
test-developer workflow: re-check the changed surface, run relevant tests/builds, think
through edge cases and regressions, and report what was verified and what risk remains.

## Git and branch workflow

Never push directly to `main`.

Before creating a branch for someone, ask them first and confirm the branch name. Prefer
one personal working branch per user, ideally named `users/<username>`. Push work to that
user's branch, then move code to `main` only through a manual pull request after required
checks pass.

## Working across frontend and backend on this project

If you're working on one side of a frontend/backend split that another person owns the
other side of: **the API contract section of `PROJECT_CONTEXT.md` is the agreed
interface** between the two. Generate code that matches it exactly. If you need to
change it, update that section in the same change, and flag the change explicitly in
your response — don't silently drift the contract without saying so, since the other
person's AI session won't otherwise know it changed.

## Build and validation

Use Node.js 20.19, Node.js 22.12, or Node.js 24+; `.nvmrc` and GitHub Actions use Node.js 24. Install dependencies in
`conductor-app`, `skills-mcp-server`, and `skills-vscode-extension` with `npm ci`.

Run the complete repository check from the repository root:

```bash
npm run verify:repo
```

This validates every catalog skill, then runs the Conductor tests and production build,
MCP tests/build, and VS Code extension compile/bundle checks. On Windows PowerShell systems that block `npm.ps1`,
run `npm.cmd run verify:repo`. The client-import tests create temporary folders under
`.agents/skills` and `.claude/skills`, so those locations must be writable.
