# Architecture Diagram And Operator Runbooks

## 1. Platform Architecture

```text
                    +---------------------------+
                    |  Users / Coding Agents    |
                    |  Codex, MCP, VS Code      |
                    +-------------+-------------+
                                  |
                                  v
                    +---------------------------+
                    |     Shared Skill Library  |
                    |  skills/*/SKILL.md        |
                    |  skills/*/references/*.md |
                    +-------------+-------------+
                                  |
               +------------------+------------------+
               |                                     |
               v                                     v
  +---------------------------+         +-----------------------------+
  | Skills MCP Server         |         | VS Code Extension           |
  | list_skills / get_skill   |         | browse / preview / insert   |
  | read_context / update     |         | emit skill activity events  |
  +-------------+-------------+         +--------------+--------------+
                \                                       /
                 \                                     /
                  v                                   v
                +---------------------------------------+
                |         Conductor App (Next.js)       |
                | auth, admin UI, APIs, approvals,      |
                | audit logs, notifications, workflows, |
                | imported workspaces, release ops      |
                +------------------+--------------------+
                                   |
                 +-----------------+------------------+
                 |                                    |
                 v                                    v
        +---------------------+             +------------------------+
        | PostgreSQL / Prisma |             | Filesystem State       |
        | users, notifications|             | skills, context,       |
        | workflows, audit    |             | QA reports, versions,  |
        |                     |             | snapshots, demo data   |
        +---------------------+             +------------------------+
```

## 2. Operator Runbooks

### A. Start the platform locally

1. Open `conductor-app/.env` and confirm DB, auth, OAuth, and event secrets are set.
2. Run `cd conductor-app`.
3. Run `npm install`.
4. Run `npm.cmd run prisma:generate`.
5. Run `npm.cmd run prisma:migrate`.
6. Run `npm.cmd run dev`.

### B. Seed demo mode for presentation

1. Run `cd conductor-app`.
2. Run `npm.cmd run demo:seed`.
3. Open `/admin`.
4. Review the seeded imported workspaces and release snapshot cards.

### C. Capture a stable release snapshot

1. Open `/admin`.
2. In `Release operations`, enter a label.
3. Click `Capture snapshot`.
4. Confirm the snapshot appears with branch, commit, and skill summary data.

### D. Review branch and merge readiness

1. Open `/admin`.
2. Read the `GitHub integration` panel.
3. Confirm branch is not `main`, working tree is clean, and there are no readiness blockers.
4. Push to the personal branch only.
5. Open a manual PR into `main` after checks pass.

### E. Investigate failing workflows or validations

1. Open `/admin`.
2. Use the `System health` panel to inspect failed workflow runs.
3. Check `Skill analytics` for health warnings and validation failures.
4. Re-run local verification with `npm.cmd test` and `npm.cmd run build`.
5. Capture a new snapshot after the fix is stable.

### F. Review imported workspace risk

1. Open `/admin`.
2. Inspect `Workspace intelligence`.
3. Review freshness age, risk signals, recommended skills, and recent file activity.
4. Update the workspace `CONTEXT.md` if risk signals show stale or incomplete context.

## 3. Handoff Notes

- GitHub readiness in the conductor app is currently repository-local, not live GitHub API polling.
- Release snapshots are filesystem-backed under `conductor-app/data/release-snapshots/`.
- Demo mode is intentionally lightweight so presentations work even without external services.
