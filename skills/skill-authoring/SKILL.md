---
name: skill-authoring
description: Use this skill when Codex needs to create, scaffold, extend, or refactor a SKILL.md-based skill inside a skills library. Trigger it for requests like "create a new skill", "make a skill for X", "add references for this skill", "turn this repeated workflow into a skill", "create a meta-skill", or "reuse patterns from other skills". This skill is specifically for authoring high-quality skill folders with SKILL.md and optional references that match the conventions of the surrounding skill library rather than generating generic documentation.
---

# Skill authoring

Create skills that are reusable, narrow enough to stay trustworthy, and consistent with the existing library.

## Role framing and boundaries

- Own skill scope design, trigger quality, reference structure, and consistency with the surrounding library.
- Reuse existing skills deliberately instead of creating duplicate or over-broad new ones.
- Stay focused on authoring the skill itself, not on turning the folder into general-purpose documentation.

This role is the librarian and systems designer for the skill catalog, not just a markdown writer.

## Step 1 - Inspect before writing

Before creating or changing a skill:

1. Read the target library structure.
2. Inspect 2-4 nearby skills that solve similar problems.
3. Reuse naming, trigger style, tone, and reference layout from the closest matches.
4. Avoid inventing a brand-new pattern if a good local pattern already exists.

Read `references/library-patterns.md` before drafting the new skill so the output stays aligned with the existing library.

## Step 2 - Decide whether the skill should exist

Create a new skill only if at least one of these is true:

- The workflow is repeated often enough that it deserves a reusable guide.
- The task needs domain-specific instructions that would not reliably come from general coding knowledge.
- The task benefits from bundled references, templates, or scripts.
- The current library has a gap that forces users to repeat the same prompt engineering every time.

Do not create a new skill if:

- An existing skill can be extended with a small edit.
- The request is too broad and would produce a vague "do everything" skill.
- The new skill would mostly duplicate another skill's scope.

If duplication risk exists, prefer updating the existing skill or creating a smaller companion skill with clearly different triggering.

## Step 3 - Define the smallest useful scope

Write down:

- What the skill does.
- What it explicitly does not do.
- What kinds of user requests should trigger it.
- Which existing skills it should defer to for adjacent work.

Prefer a narrow, dependable skill over a broad skill with weak instructions.

## Step 4 - Design the folder

Every new skill must include:

- `SKILL.md`

Add `references/` only when detailed material would otherwise bloat `SKILL.md`.

Good uses for `references/`:

- framework-specific variants
- checklists
- schemas
- reusable decision rules
- examples that are useful but not core enough for the main file

Do not add extra files like `README.md`, `CHANGELOG.md`, or setup notes unless the repo already requires them.

## Step 5 - Write the frontmatter carefully

The frontmatter is the trigger surface.

- `name` must match the folder name.
- `description` must say both what the skill does and when to use it.
- Put trigger phrases in the description, not in a separate "when to use" section.
- Mention neighboring skills when routing matters.

## Step 6 - Write the body as operating instructions

The body should help another Codex instance succeed quickly.

Include:

- a short mission statement
- the ordered workflow
- any must-read reference files and when to read them
- scope boundaries and handoff rules
- quality bars and validation checks

Use imperative instructions. Keep explanations short. Prefer decision rules over long essays.

## Step 7 - Reuse existing skills deliberately

When the new skill overlaps with existing skills:

1. Read the closest skills first.
2. Borrow useful phrasing patterns and structure.
3. Reference adjacent skills explicitly in scope boundaries.
4. Avoid copying long passages unless they are truly reusable and still correct.

The goal is a coherent library, not isolated one-off skills.

## Step 8 - Validate the draft

Before finishing:

1. Check that the skill name is clear and folder-safe.
2. Check that the description would trigger on realistic user wording.
3. Check that the body stays focused and does not drift into unrelated domains.
4. Check that references are linked from `SKILL.md`.
5. Check that the skill adds something distinct to the library.

## Output expectations

When asked to create a new skill:

1. Inspect the library and closest related skills.
2. Choose the smallest useful skill name.
3. Create `SKILL.md`.
4. Create only the references that materially help.
5. Keep the result aligned with local conventions.

If the user asks for a meta-skill that creates other skills, bias toward scaffolding, review, and reuse of existing patterns instead of unconstrained skill generation.
