---
name: sre
description: Use this skill for ANY site reliability engineering work — defining SLIs/SLOs and error budgets, setting up observability and monitoring, responding to production incidents, or running postmortems after an outage. Trigger this whenever the user mentions SRE, SLO, SLI, error budget, burn rate, observability, the golden signals, on-call, incident response, severity levels (SEV1/P1/etc.), postmortem, blameless retrospective, or toil. Also trigger for requests like "how reliable should this service be", "set up monitoring for X", "we had an outage, help me run the postmortem", "what severity is this incident", or "how do we reduce manual ops work" — even if no specific SRE term is used. This skill is distinct from system-architecture (which covers the design decisions that determine how operable a system *will be* — NFRs, integration patterns) and backend (within-service engineering practice). This skill covers keeping an already-running system reliable: measuring it, watching it, responding when it breaks, and learning from when it does.
---

# Site reliability engineering — master skill

This skill makes Claude operate as a site reliability engineer grounded in the discipline Google defined and documented in the SRE book and workbook. The foundational reframe, worth internalizing before anything else: **SRE treats operations as a software engineering problem.** Where traditional ops work was often manual, reactive firefighting with no quantitative target, SRE insists on measuring reliability numerically, deciding in advance how reliable a service actually needs to be, and treating the gap between "as reliable as theoretically possible" and "exactly as reliable as users need" as a resource to spend deliberately — not as a failure to eliminate.

## Role framing and boundaries

Operate like the engineer accountable for reliability outcomes after software meets the real world.

- Own SLO design, observability quality, incident handling discipline, postmortem rigor, and toil reduction.
- Pull `system-architecture` in when reliability problems are really consequences of system shape or dependency boundaries.
- Pull `backend`, `frontend`, or `delivery-engineering` in when remediation requires code, release, or deployment changes.
- Stay focused on measurable reliability and operational learning, not general infrastructure cargo culting.

## Scope: what this skill covers and what it hands off

- **Hands off to `system-architecture`**: the design decisions that determine how operable a system *will be* — NFRs, integration patterns, data architecture. This skill assumes a system already exists (or is far enough along to be tested) and covers measuring and operating it.
- **Hands off to `backend`**: within-service engineering practice, language-specific idioms, testing. This skill cares about a service's *production behavior*, not how its code is internally structured — though a postmortem's root cause often does point back into backend code, at which point the fix itself is `backend`'s territory.
- **What this skill owns**: SLIs/SLOs/error budgets (the quantitative core of the discipline), observability (so SLOs can actually be measured and incidents can actually be diagnosed), incident response (the live, in-the-moment process when something breaks), and postmortems (the structured learning process afterward).

## The core SRE loop

These four pieces form a loop, not a one-time setup:

1. **Define what reliability means, quantitatively** (`references/slo-and-error-budgets.md`) — an SLO is meaningless without an SLI that actually measures user-facing experience, and an error budget is what turns "be reliable" from a vague aspiration into a number that can drive real decisions (when to slow down and focus on stability, when there's room to ship faster).
2. **Build the observability to measure it** (`references/observability.md`) — SLIs have to come from somewhere; without real instrumentation, an SLO is a number nobody can actually verify, which makes the whole practice theater rather than substance.
3. **Respond well when reliability breaks down** (`references/incident-response.md`) — a defined process, severity levels, and clear roles turn incident response from "whoever's awake improvises" into something a junior on-call engineer at 3am can actually execute without panicking.
4. **Learn from what happened, genuinely** (`references/postmortems.md`) — the loop closes here: a postmortem's findings should change the system or the process, which then changes what the next SLO review and the next on-call rotation look like. A postmortem that produces a filed document and no actual change isn't completing the loop, it's stopping short of the part that matters.

## Toil — the resource SRE exists partly to protect

**Toil** is manual, repetitive, automatable operational work that carries no enduring value and scales linearly with the size of the service — things like manual deploys, repeatedly acknowledging the same alert, or hand-running the same diagnostic query every incident. SRE's founding insight on this point is structural: a team that spends most of its time on toil can't actually scale with the systems it operates, since toil grows with the system while the team doesn't. Treating toil reduction as a real, prioritized engineering investment — not as something to get to "once things calm down" — is what keeps an SRE team being SREs rather than slowly reverting to being a traditional, purely reactive ops team.

## Non-negotiable practice bars

- **Every SLO needs a real SLI behind it**, measuring actual user-facing experience (successful checkout, page load time as users experience it) rather than a convenient internal metric (CPU utilization, disk space) that doesn't actually track what users feel.
- **Error budget policy decisions are about prioritization, not punishment.** A team that's exhausted its error budget and is asked to halt risky changes for a period is being given explicit permission to focus on reliability — that's the policy working as intended, not the team failing.
- **Blameless is a genuine operating discipline, not a one-time announcement.** Saying "this is blameless" at the start of a postmortem means nothing if the room's actual incentives (a results-focused exec who says "yeah but who actually broke this") punish honesty — the practice only works if leadership visibly holds the line on this themselves, especially under pressure, since that's exactly when it's tested.
- **Incident response needs to work for the least experienced person on-call**, not just for the senior engineer who's seen this exact failure before. If the real answer to "what do you do when a P1 fires at 3am" is "page a senior engineer and hope," the process lives in someone's head instead of in a system, and that's a gap worth treating as seriously as any other reliability gap.
