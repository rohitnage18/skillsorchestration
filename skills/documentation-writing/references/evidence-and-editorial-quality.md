# Evidence and editorial quality

Read this before finalizing any substantial report or documentation artifact.

## Evidence ledger

For material facts, mentally or explicitly track:

| Claim | Evidence | Date/version | Confidence | Document treatment |
|---|---|---|---|---|
| Current behavior | Source/test/output | Current snapshot | High | State as verified |
| Intended behavior | Maintained project document | Document date | Medium | State as documented |
| External state | Production/GitHub/provider observation | Observation date | High if observed | State as observed |
| Derived conclusion | Multiple verified facts | Current snapshot | Medium | State as inference |
| Future capability | Roadmap/TODO | Plan date | Low as current fact | State as planned |

Use exact dates for volatile facts. Avoid “currently” when the artifact will be read later without a report date.

## Source conflict rules

When sources disagree:

1. prefer current executable behavior over narrative documentation;
2. prefer captured test/command output over an older reported result;
3. prefer the current schema/configuration over historical implementation notes;
4. preserve the conflict as a documentation finding if readers could be misled;
5. do not silently rewrite history to make the project look consistent.

## Writing standards

- Lead paragraphs with their conclusion or purpose.
- Use plain language and define unavoidable technical terms.
- Prefer active voice when ownership matters.
- Use one term for one concept throughout.
- Keep headings descriptive and parallel.
- Use bullets for discrete items and prose for reasoning.
- Use tables only when readers compare repeated fields.
- Keep code blocks runnable and limited to relevant commands.
- Avoid praise, marketing adjectives, and vague intensifiers unless evidence supports them.
- Avoid false precision; use exact counts only when they are captured and reproducible.

## Sensitive-information review

Before delivery, search for:

- tokens, passwords, secrets, keys, and connection strings;
- real personal email addresses or identifiers not needed by the audience;
- internal/private URLs and repository details beyond authorized scope;
- copied `.env` values;
- logs or stack traces containing sensitive data;
- proprietary source excerpts that should be summarized instead.

Use variable names and safe placeholders rather than real values.

## Consistency review

Check:

- document title, filename, report date, branch, commit, and version;
- heading numbering and appendix labels;
- terminology, capitalization, and acronym expansion;
- repeated counts, statuses, and conclusions;
- status colors/labels and their definitions;
- link targets and file paths;
- table totals and percentages;
- tense differences between completed, in-progress, and planned work;
- whether executive claims are supported later in the document.

## Markdown validation

- File is UTF-8.
- Heading levels do not skip without reason.
- One blank line appears around headings, lists, tables, and code blocks.
- Fenced code blocks are closed and use an appropriate language label.
- Tables render with the expected number of columns.
- Local links use correct relative or absolute paths for the target renderer.
- No trailing whitespace exists except intentional Markdown line breaks.
- A diff/whitespace check passes.

## Word/PDF validation

- Title page and document-control fields render correctly.
- Heading styles drive the table of contents.
- Page breaks do not orphan headings or split critical table rows badly.
- Headers, footers, page numbers, margins, fonts, and colors are consistent.
- Diagrams remain legible when printed.
- Code and long URLs wrap without clipping.
- Accessibility metadata and meaningful link text are used where the tool supports them.
- The generated artifact is opened and visually inspected, not merely created.

## Final acceptance checklist

- The intended reader can understand the executive conclusion without repository access.
- A technical reader can trace important claims to evidence.
- Unknowns and limitations are visible.
- The document contains no unsupported approval or readiness claim.
- Recommended actions are prioritized and verifiable.
- The delivered path and format match the request.
- The artifact has been checked after generation.

