# Skill Orchestrator Next Improvements TODO

This list focuses on the highest-value work still worth doing after the current notification,
approval, analytics, CI/CD, and skill-library foundations that are already in place.

## Priority 1: Identity and trust model

- [x] Replace the raw external event user-id dependency with a first-class admin-managed `externalUserId` mapping so MCP/VS Code users resolve to trusted conductor users more safely.
- [x] Add a documented user-branch ownership model so a user record can be associated with a preferred Git branch name.
- [x] Add admin-visible user activity history pages showing which skills, workflows, and imported workspaces each user has touched.
- [x] Add clearer user onboarding states such as invited, pending approval, active, disabled, and last-seen.

Remaining identity follow-up:

- [ ] Remove or formalize any remaining parallel identity assumptions between browser-auth users and external event users, especially around conflict handling and admin visibility.
- [ ] Add explicit admin warnings for email/external-user-id identity conflicts before they block event ingestion.

Why this matters:
The orchestrator is already strong on logging, but it still needs a cleaner identity backbone so every action, approval, and branch workflow is tied to a real trusted user.

## Priority 2: Skill quality governance

- [x] Add skill scorecards that combine metadata health, reference coverage, QA report history, and trigger-quality results into one visible quality grade.
- [x] Add skill ownership metadata so each skill has an accountable maintainer or steward.
- [x] Add stale-skill detection based on last update date, failed validations, and outdated references.
- [ ] Add dependency mapping between skills so admins can see which skills reference or rely on others.
- [x] Add stronger duplicate-skill detection to catch overlapping scope before the library becomes noisy.

Why this matters:
The library is growing fast. Governance will matter more and more as the number of skills, references, and contributors increases.

Latest verified milestone:

- [x] Skill scorecards now surface per-skill score, grade, and stability in the skill browser, skill detail, and admin analytics.
- [x] Stable-skill analytics now highlight the strongest reusable skills and give admins a watchlist view for weaker ones.
- [x] This governance layer was re-verified on July 16, 2026 with `npm test` and `npm run build` in `conductor-app`.
- [x] Duplicate-skill detection now compares new skill drafts against the existing library before creation.
- [x] High-overlap drafts now require explicit confirmation before creation.

## Priority 3: Better skill authoring workflow

- [x] Add a guided "create skill" wizard in the conductor app that scaffolds `SKILL.md`, references, trigger description, and suggested neighboring skills.
- [ ] Add built-in skill preview tests where an admin can paste sample prompts and see whether a skill would likely trigger.
- [ ] Add reference completeness checks so a skill can be flagged when it mentions frameworks or patterns without matching reference files.
- [ ] Add side-by-side comparison for draft vs approved skill change requests before approval.
- [ ] Add "promote to reusable skill" flow for frequently repeated patterns observed in approval requests or imported workspaces.

Why this matters:
Right now skill authoring is powerful but still file-centric. A more guided authoring path would make the system easier to scale to more admins and contributors.

## Priority 4: Workflow and automation depth

- [ ] Add workflow templates for common orchestrator tasks such as skill review, QA review, security review, and release-readiness review.
- [ ] Add post-change policy chaining so `quality-engineering`, `security-engineering`, or `delivery-engineering` can be auto-suggested based on changed files.
- [ ] Add approval gates so certain high-risk skill edits require both admin approval and a completed QA or security check.
- [ ] Add retry/replay controls for failed workflow runs and external skill events.
- [ ] Add workflow execution history dashboards with duration, failure cause, and affected resources.

Why this matters:
The project already supports skills and workflows, but deeper orchestration will make it feel like a real operating system for engineering guidance rather than just a skill browser.

## Priority 5: Testing and reliability maturity

- [x] Add lightweight conductor smoke tests covering primary pages plus summary and QA-report flows.
- [x] Add contract tests between conductor app, MCP server, and VS Code extension for shared skill metadata shape.
- [ ] Add snapshot or golden-file tests for generated QA reports and analytics summaries.
- [ ] Add seeded demo data so the full system can be validated quickly in a clean environment.
- [x] Add periodic CI validation for sample skills to ensure the library keeps passing trigger and metadata quality checks.
- [ ] Add deeper browser-level admin-flow tests for user approval, restore actions, and version comparison UX.

Why this matters:
The project has good local tests, but system-level confidence will improve a lot once the cross-surface flows are validated more deeply.

Latest verified milestone:

- [x] `conductor-app` now runs 18 passing tests including smoke checks, filesystem integration tests, and cross-surface contract validation.
- [x] The repo now has a top-level `npm run verify:repo` command that runs the full conductor, MCP server, and VS Code extension verification stack.
- [x] GitHub Actions now includes `.github/workflows/repo-verification.yml` for continuous repository-wide verification on branch pushes and PRs to `main`.

## Priority 6: Better admin and observability UX

- [ ] Add a dedicated system health page showing event ingestion health, notification delivery health, recent failures, and validation trends.
- [ ] Add a user timeline view combining approvals, skill usage, edits, workflow runs, and notifications in one place.
- [ ] Add diff-friendly visualizations for skill metadata changes, not only file text changes.
- [ ] Add saved filters and dashboards for admins who monitor specific users, skills, or event types repeatedly.
- [ ] Add lightweight charts for library growth, most-used skills, most-edited skills, and most failure-prone skills over time.

Why this matters:
The conductor app already has useful admin features, but observability can become much more operational and decision-friendly.

## Priority 7: Branch, PR, and GitHub integration

- [x] Add explicit repository settings/setup documentation for required branch protection, required checks, and PR review rules.
- [ ] Add optional GitHub API integration so the conductor app can show PR status, branch state, and whether required checks passed.
- [ ] Add a branch registration field on user profiles so admins can track who owns which working branch.
- [ ] Add warnings in conductor when a requested change is not associated with the user's approved branch.
- [ ] Add "ready for PR" checklists tied to validation outputs from quality, security, and delivery skills.

Why this matters:
The CI/CD foundation is in place, but the Git workflow is still mostly documented policy rather than deeply integrated orchestration behavior.

## Priority 8: Imported workspace intelligence

- [ ] Add per-imported-project dashboards showing context freshness, recent skills used, QA reports, and unresolved risks.
- [ ] Add imported workspace inventory pages so admins can browse all conductor-managed projects centrally.
- [ ] Add context freshness checks that warn when an imported project's `CONTEXT.md` is outdated relative to recent code or skill activity.
- [ ] Add project-level recommended skills based on tech stack or recent file changes.
- [ ] Add project archival or lifecycle states for old imported workspaces.

Why this matters:
Imported workspaces are one of the most powerful parts of the concept. They can become much more useful as managed project intelligence surfaces.

## Priority 9: Documentation and adoption

- [ ] Add a single architecture diagram showing how skills, MCP server, VS Code extension, conductor app, users, and notifications fit together.
- [ ] Add operator runbooks for common admin tasks such as approving users, restoring skills, rotating tokens, and troubleshooting event failures.
- [ ] Add contributor standards for writing new skills, reference files, and validation-ready prompts.
- [ ] Add demo walkthrough docs for presenting the project to evaluators, teammates, or interviewers.
- [ ] Add a "what this project is not" section so scope boundaries are clearer for future contributors.

Why this matters:
The project is now rich enough that adoption and maintenance will benefit from sharper operator and contributor documentation.

## July 19, 2026 verified note

- [x] The conductor skill authoring wizard, duplicate-skill similarity checks, and duplicate-confirmation gate were re-verified on Sunday, July 19, 2026 with passing `npm.cmd test` and `npm.cmd run build` in `conductor-app`.
- [x] Branch protection guidance now exists in both `README.md` and `docs/CI_CD_BRANCH_POLICY.md`.

## Suggested implementation order

1. Identity and trust model
2. Skill quality governance
3. Better skill authoring workflow
4. Testing and reliability maturity
5. Branch, PR, and GitHub integration
6. Better admin and observability UX
7. Workflow and automation depth
8. Imported workspace intelligence
9. Documentation and adoption
