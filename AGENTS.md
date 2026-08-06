# Instructions for Codex working in this repository

**Read `PROJECT_CONTEXT.md` at the repo root first.** It is the shared source of truth
for this project's architecture, current frontend/backend API contract, decisions log,
and status. It is kept current so Codex and other AI sessions do not need to be
re-briefed on project context every session. If something in the code conflicts with
`PROJECT_CONTEXT.md`, flag the mismatch explicitly instead of silently choosing one.

## What this repository is

A skill orchestration workspace: a reusable `skills/` library, an MCP server
(`skills-mcp-server/`), a VS Code extension (`skills-vscode-extension/`), and a
Next.js conductor control plane (`conductor-app/`) for audit logs, notifications,
approvals, registry skills, workflows, and imported project workspaces.

## Required agent workflow

Before meaningful work:

1. Read `PROJECT_CONTEXT.md`.
2. Read the active project `CONTEXT.md`.
3. Identify the smallest relevant skill under `skills/`.
4. Read that skill's `SKILL.md` and any required files in its `references/` folder.

During work:

1. Keep changes focused on the user's request.
2. Preserve unrelated user or generated work in the tree.
3. Follow the selected skill's workflow and the repo's existing implementation patterns.

After meaningful code creation, update, refactor, or bug fix:

1. Run the `skills/quality-engineering/SKILL.md` workflow before handing work back.
2. Run the relevant automated checks for the changed surface.
3. Update `CONTEXT.md` when project status, decisions, blockers, architecture, or
   workflow behavior changed.
4. Summarize what changed, what was verified, and any residual risk.

## Using skills in this repo

When working directly in this checkout, read skill content from disk:

- `skills/<name>/SKILL.md`
- `skills/<name>/references/*.md`

The MCP server also exposes the same workflow to compatible clients through:

- `read_context`
- `update_context`
- `list_skills`
- `get_skill`
- `import_skill`

Use `import_skill` when a user wants a library skill installed into a client project:

- Codex: `.agents/skills/<skill-name>/SKILL.md`
- Claude Code: `.claude/skills/<skill-name>/SKILL.md`

## Git and branch workflow

Do not push directly to `main`.

Before creating a new branch, explicitly confirm the branch name with the user. Prefer
one personal working branch per user, ideally named `users/<username>`. Legacy personal
branches such as `sanay` can continue when already in use.

Keep each user's commits on that user's branch, push there first, and move code to
`main` only through a manual pull request after required checks pass.

## Working across frontend and backend on this project

If frontend and backend work is split across people or agent sessions, the API contract
section of `PROJECT_CONTEXT.md` is the agreed interface. Generate code that matches it.
If the contract needs to change, update that section in the same change and call it out
explicitly so the other session can adjust.
