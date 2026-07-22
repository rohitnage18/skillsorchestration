# Professional project report

Use this reference for comprehensive project reports, formal current-state assessments, stakeholder reports, implementation reports, and handover reports.

## Recommended document architecture

Choose only the sections the decision and audience require, but use this order for a comprehensive report:

1. Title and document control
2. Executive summary
3. Purpose, audience, scope, and limitations
4. Project charter or objectives
5. Current solution and architecture
6. Component or workstream detail
7. Data, integrations, security, and operations
8. Delivery, testing, and verification evidence
9. Current status by dimension
10. Accomplishments and work in progress
11. Risks, assumptions, issues, dependencies, and decisions
12. Gaps and technical debt
13. Prioritized recommendations and roadmap
14. Success measures and decisions required
15. Conclusion
16. Appendices for inventories, commands, evidence, and glossary

## Document control

For a formal report, capture:

- document title;
- report date and reporting period;
- project/repository name;
- version, branch, commit, or release reviewed;
- author/preparer role;
- status such as draft, reviewed, or approved only when known;
- intended audience;
- evidence sources and validation date.

Do not fabricate an approver or approval status. Use `Owner required`, `Not assigned`, or `Not verified` where necessary.

## Executive summary formula

Keep the executive summary useful on its own:

1. State what the project is and the value it provides.
2. State the evidence-backed overall condition.
3. Name the strongest verified accomplishments.
4. Name the one to three material constraints or risks.
5. State the recommended decision or immediate next action.

Include unfavorable evidence when it changes the decision. Avoid leading with implementation detail.

## Status reporting

When no organization-specific thresholds exist, define the ratings used in the report and disclose the limitation.

Rate dimensions independently, typically:

- scope;
- schedule;
- budget;
- resources/ownership;
- technical health;
- quality/testing;
- security/compliance;
- operations/readiness;
- documentation/governance;
- release readiness.

Do not rate schedule or budget green if no baseline exists. Use `Not measured` where the reporting system permits it; otherwise use Amber with a precise explanation that the baseline is absent.

## RAID quality

Keep risks, assumptions, issues, and dependencies distinct:

- A risk may happen.
- An issue has happened or exists now.
- An assumption is being treated as true without sufficient confirmation.
- A dependency is something the project relies on.
- A decision records or requests a material choice.

Every high-value entry should include impact and an owner or owner-required marker. Risks should include likelihood, impact, response, and trigger/contingency where useful.

## Recommendation design

Recommendations should include:

- the action;
- why it matters;
- priority or phase;
- dependency/order;
- accountable role;
- completion evidence.

Prefer a phased roadmap over an undifferentiated list. Put release blockers and truth-alignment work before expansion features.

## Report completeness check

- Does the executive summary match the detailed findings?
- Is the evidence date/version explicit?
- Are verified, documented, inferred, and unverified facts distinguishable?
- Is in-progress work separated from committed/released work?
- Are status ratings supported by evidence?
- Are risks and issues actionable?
- Are recommendations prioritized and measurable?
- Does the conclusion answer whether the project met the report’s objective?

