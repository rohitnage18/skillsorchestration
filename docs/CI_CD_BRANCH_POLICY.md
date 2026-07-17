# CI/CD Branch Policy

This repository now uses GitHub Actions to validate branch work and pull requests before code reaches `main`.

## What the workflows do

- `.github/workflows/branch-ci.yml`
  Runs on every push to any branch except `main`.
- `.github/workflows/repo-verification.yml`
  Runs the full repository verification stack on branch pushes and pull requests.
- `.github/workflows/pr-main.yml`
  Runs on every pull request targeting `main`.
- `.github/workflows/direct-main-guard.yml`
  Fails if someone pushes directly to `main`.
- `.github/workflows/branch-policy.yml`
  Verifies that working branches are personal branches and that pull requests are used only for manual merge into `main`.

The CI checks currently cover:

1. `conductor-app`
   Runs `npm ci`, `npm test`, and `npm run build`
2. `skills-mcp-server`
   Runs `npm ci` and `npm run build`
3. `skills-vscode-extension`
   Runs `npm ci`, `npm run compile-check`, and `npm run build`
4. Full repository verification
   Runs `npm run verify:repo`

## QA skill after code changes

Repository agents should also invoke the `quality-engineering` skill after meaningful
code changes. That skill acts as the senior tester role for:

- affected-surface audit
- scenario and edge-case review
- regression thinking
- release-readiness reporting

The GitHub Actions workflows enforce build and test commands automatically. The
`quality-engineering` skill adds the broader QA reasoning layer that CI alone does not
cover.

## Important limitation

The workflow that fails on direct pushes to `main` is only a warning mechanism after the push reaches GitHub.

To truly prevent direct pushes, enable GitHub branch protection for `main`.

## Recommended GitHub settings

In GitHub:

1. Open `Settings`
2. Open `Branches`
3. Add a branch protection rule for `main`
4. Enable:
   - `Require a pull request before merging`
   - `Require status checks to pass before merging`
   - `Require branches to be up to date before merging`
   - `Do not allow bypassing the above settings`
5. Select these required checks:
   - `Enforce personal branch policy`
   - `Conductor app checks`
   - `MCP server build`
   - `VS Code extension build`
   - `Full repository verification`

## Personal branch policy

The intended delivery model is:

1. Ask the user before creating a new Git branch for them
2. Give each user one personal working branch
3. Keep that user's commits and pushes on their own branch
4. Push that branch and let GitHub verify and test it automatically
5. Open a manual pull request from that branch into `main`
6. Merge only after required checks pass and a human approves the PR

PRs into other personal branches are not part of the intended workflow and should be avoided.

Recommended branch names:

- `users/<username>`
- legacy single-name personal branches such as `sanay` can continue temporarily, but `users/<username>` is the preferred standard for new work

What CI can and cannot enforce:

- CI can validate branch pushes, enforce that PRs target `main`, and reject direct pushes to `main`
- GitHub branch protection can require PRs and required checks before merge
- Agent prompting before creating a branch is a workflow rule and is documented in repo instructions for Codex/Copilot/Claude
- Automatically pushing "whatever a user works on" to GitHub still depends on the local operator or agent session performing the git push on that user's branch

## Suggested team workflow

1. Confirm the branch name with the user before creating it
2. Create or switch to that user's personal branch such as `users/sanay` or legacy `sanay`
3. Commit changes on that branch
4. Push that branch to GitHub
5. Let `Branch CI`, `Branch Policy`, and `Repository Verification` run automatically
6. Open a manual pull request into `main`
7. Let `PR To Main`, `Branch Policy`, and `Repository Verification` pass on the PR
8. Merge only through the manual pull request

## Result

This setup keeps generated or edited code on branches first and makes `main` a reviewed merge target instead of a direct-push branch.
