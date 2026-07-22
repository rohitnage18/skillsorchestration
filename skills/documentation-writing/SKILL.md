---
name: documentation-writing
description: Use this skill to research, structure, draft, improve, or quality-check professional documentation and formal reports from project evidence. Trigger it for requests such as "write a detailed project report", "create technical documentation", "prepare a professional report", "improve this report", "document this repository", "write an executive summary", "create a handover document", or "turn these notes and source files into a polished document". This skill owns evidence-based synthesis, document architecture, audience-appropriate writing, traceability, and editorial validation. Use project-management for delivery status and RAID judgments, business-analysis for BRDs/business cases, system-architecture for architecture decisions, and quality-engineering for QA findings; use this skill to compose those verified inputs into a coherent professional artifact.
---

# Documentation writing

Produce professional documents that are accurate, useful to their intended audience, easy to navigate, and explicit about what is verified, inferred, planned, or unknown.

## Role framing and boundaries

Operate like a senior technical writer and documentation lead embedded with the project team.

- Own audience analysis, evidence collection, information architecture, narrative coherence, terminology, traceability, and final editorial quality.
- Inspect the real source material before drafting. Do not turn assumptions into facts or copy stale documentation without reconciling it with current evidence.
- Use adjacent domain skills for the judgments they own, then translate their outputs into a consistent document.
- Do not invent sponsors, budgets, delivery dates, production results, compliance status, or approvals.
- Do not let presentation hide unfavorable evidence. A professional report is decision-useful, not promotional copy.

## Step 1 — Define the document contract

Before drafting, establish from the request and available context:

1. the primary audience and the decisions they need to make;
2. the document type and expected level of formality;
3. the subject, time boundary, repository/version, and reporting date;
4. required sections, format, length, and delivery location;
5. whether the artifact is a current-state report, proposal, runbook, reference, handover, or assessment;
6. what cannot be verified and must be labeled as an assumption, limitation, or decision required.

If the user asks for a broad professional project report, read `references/professional-project-report.md`. For system, API, setup, operational, or contributor documentation, read `references/technical-documentation.md`. Always read `references/evidence-and-editorial-quality.md` before finalizing a substantial artifact.

## Step 2 — Build an evidence inventory

Inspect authoritative evidence before relying on descriptive prose.

Use this order of confidence where applicable:

1. current executable source, schema, configuration, and tests;
2. direct command output and reproducible validation results;
3. current version-control state and history;
4. maintained context, decision, and runbook files;
5. readmes, checklists, roadmaps, and historical reports;
6. clearly labeled inference.

Record important facts with their source, date, and status. When sources conflict, describe the conflict and prefer the evidence closest to current behavior. Separate committed behavior from uncommitted or proposed work.

## Step 3 — Choose the smallest complete structure

Design the document around reader questions, not around the order files were inspected.

- Lead with the outcome, purpose, or executive conclusion.
- Put essential scope, status, architecture, findings, risks, and decisions before supporting detail.
- Use appendices for inventories, commands, raw evidence, and long reference material.
- Use tables for exact mappings or repeated comparisons.
- Use a diagram only when relationships, flows, ownership, or sequence are materially clearer visually.
- Avoid duplicate sections that restate the same facts without adding a different audience view.

For long documents, include document control, scope/limitations, a navigable heading hierarchy, and a conclusion tied back to the stated objective.

## Step 4 — Draft with evidence-aware language

Use language that reveals confidence and status:

- `verified` or `observed` for direct evidence;
- `documented` for intended behavior stated in project material;
- `in progress` for uncommitted or incomplete work;
- `inferred` for a conclusion derived from multiple facts;
- `not verified` for external or production state not exercised;
- `recommended` for future action;
- `decision required` when authority or a material choice is missing.

Write executive sections for decision-makers and technical sections for implementers without changing the underlying facts. Expand abbreviations at first use. Keep terminology consistent with the product and distinguish similarly named concepts explicitly.

## Step 5 — Make status and recommendations actionable

When the document contains project status, delivery health, risks, or next steps:

1. use `project-management` for RAG criteria, milestones, RAID, ownership, and delivery judgments;
2. rate dimensions separately instead of hiding variance in one overall label;
3. state the evidence and threshold behind each rating;
4. identify an owner or `owner required` for every material action;
5. distinguish current issues from future risks;
6. order recommendations by urgency, dependency, and value;
7. avoid unsupported schedule or budget claims when no baseline exists.

When the document contains test or release findings, use `quality-engineering` for severity and release recommendations. When it contains business justification or requirements, use `business-analysis`. When it contains architecture decisions, use `system-architecture`.

## Step 6 — Validate the artifact

Before delivery, perform all relevant checks:

- factual consistency against current evidence;
- correct repository, branch, commit, version, and date references;
- no accidental exposure of secrets, personal data, tokens, or private URLs;
- headings are ordered and unique;
- tables have aligned columns and meaningful labels;
- links and local file references resolve;
- commands are syntactically plausible and use the correct working directory;
- counts and test results match captured output;
- limitations, assumptions, and unverified claims are visible;
- recommendations follow from findings;
- spelling, grammar, encoding, and terminology are consistent;
- the conclusion answers the document’s original purpose.

For Markdown, run a whitespace/structure check where practical. For generated Word or PDF artifacts, also inspect pagination, heading styles, table wrapping, code blocks, headers/footers, and table of contents rendering.

## Step 7 — Deliver with change transparency

Tell the user:

- where the artifact was created;
- what evidence period/version it covers;
- what validation was performed;
- the most important conclusion or limitation;
- whether another output format was requested but could not be generated.

Do not claim a document is approved, final, production-ready, or externally validated unless that status is evidenced.

## Non-negotiable quality bars

- Every material claim must be verifiable, explicitly attributed to project documentation, or labeled as an inference.
- Current facts and future plans must never be blended into one tense or status.
- Unfavorable evidence must remain visible in the executive summary when it affects decisions.
- A long report must be scannable: clear hierarchy, purposeful tables, short executive synthesis, and detailed appendices.
- Recommendations must be specific enough to assign and verify.
- The final artifact must be self-contained for its intended audience.

## Common failure modes

- Writing from the README alone while ignoring source, tests, or Git state.
- Producing a feature inventory without explaining value, risks, maturity, or next decisions.
- Calling a build-passing project production-ready without operational evidence.
- Treating planned features as implemented.
- Using one subjective status color for every project dimension.
- Repeating the same content under many headings to make the document appear detailed.
- Hiding uncertainty in vague language instead of naming an assumption or missing decision.
- Delivering a visually polished document with broken links, stale counts, or inconsistent terminology.

