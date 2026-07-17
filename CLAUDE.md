# Instructions for Claude Code working in this repository

**Read `PROJECT_CONTEXT.md` at the repo root first.** It is the shared source of truth
for this project's architecture, current frontend/backend API contract, decisions log,
and status — kept current by everyone working on this repo, specifically so that you
(and any other AI session working here, including GitHub Copilot via
`.github/copilot-instructions.md`) don't need to be re-briefed on project context every
session. If something in this repo's code conflicts with what `PROJECT_CONTEXT.md` says,
treat that as worth flagging explicitly rather than silently resolving it one way.

## What this repository is

A personal skills library (`skills/`, one `SKILL.md`-based domain per folder — frontend,
backend, sre, business-analysis, system-architecture, project-management, and more),
served via an MCP server (`skills-mcp-server/`) and browsable via a VS Code extension
(`skills-vscode-extension/`).

## Using the skills in this repo

The `skills-mcp-server` is the same server configured for VS Code in `.vscode/mcp.json`.
If you're working in this repo directly (not just through VS Code's Copilot
integration), you can read skill content straight from `skills/<name>/SKILL.md` and its
`references/` folder on disk — there's no need to go through the MCP server specifically
when you already have direct file access. **Read the relevant skill's `SKILL.md` before
working on a task in its domain** — these contain specific, current (2026) practices and
known issues that may go beyond general training knowledge.

After any meaningful code creation, update, refactor, or bug fix, run the
`skills/quality-engineering/SKILL.md` workflow before handing work back. Treat it as the
default senior-tester pass for changed code: verify impacted behavior, run the relevant
automated checks, cover important edge cases and regressions, and summarize findings plus
residual risk.

## Git and branch workflow

Do not push directly to `main`.

Before creating a branch, explicitly confirm the branch creation with the user. Prefer
one personal working branch per user, ideally named `users/<username>`. Keep each user's
commits on that user's own branch, push there first, and move code to `main` only through
a manual pull request after required checks pass.

## Working across frontend and backend on this project

If two people are splitting frontend and backend work on this project, the **API
contract section of `PROJECT_CONTEXT.md`** is the agreed interface between the two
sides — generate code that matches it exactly, and if it needs to change, update that
section in the same change and say so explicitly, since the other person's session has
no other way of finding out.
