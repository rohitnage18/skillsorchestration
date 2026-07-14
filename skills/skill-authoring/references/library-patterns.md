# Library patterns

Use this file before authoring or refactoring a skill in this repository.

## Patterns to preserve

- Use a strong trigger-oriented `description` in frontmatter.
- Treat `SKILL.md` as the routing and operating file.
- Move detailed or variant-specific material into `references/` when needed.
- Use explicit handoffs to nearby skills when domains overlap.
- Keep the skill opinionated enough to be useful, but not so broad that it becomes generic.

## Useful local examples

- `backend`:
  Strong trigger language, clear architecture-first workflow, explicit reference routing by language.
- `frontend`:
  Strong trigger language, clear engineering bars, explicit reference routing by framework.
- `project-management`:
  Good scope boundaries, clear handoff from adjacent domains, concise stepwise process.

## Naming guidance

- Prefer action-oriented or domain-specific names.
- Keep names short and easy to infer from a user request.
- Avoid names that collide with broad platform/system skills unless the new skill is intentionally a local variant.

## Reference usage guidance

Create reference files only when they help reduce noise in `SKILL.md`, for example:

- separate variants by framework or language
- preserve checklists or templates
- keep examples out of the main instructions

Do not create references just to make the skill feel larger.

## Quality test

A new skill in this repo is usually good if:

- another agent could tell when to use it from frontmatter alone
- the body provides a concrete workflow, not generic advice
- it clearly differs from neighboring skills
- it can point to existing skills instead of re-explaining their whole domain
