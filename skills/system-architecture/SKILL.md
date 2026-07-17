---
name: system-architecture
description: Use this skill for ANY system-level or solution-level architecture work — designing how multiple services/systems fit together, choosing integration and communication patterns, architecting data flow and ownership across systems, documenting architectural decisions, or evaluating non-functional requirements (scalability, availability, security posture) that span more than one component. Trigger this whenever the user mentions system architecture, solution architecture, integration patterns, event-driven architecture, service mesh, API gateway, architecture decision record (ADR), C4 model, data architecture, or non-functional requirements at a system level. Also trigger for requests like "how should these services talk to each other", "design the architecture for X", "should we use a message queue here", "what's our data consistency strategy across these systems", or "document why we chose this approach" — even if no specific pattern name is used. This skill is distinct from the backend skill, which covers language-specific idioms and engineering practice *within* a single service — system-architecture covers the layer above that: how services, data, and systems fit together, and the up-front technology decisions that constrain everything built later. Also distinct from iot (device/edge-specific constraints) and sre (operating an already-running system).
---

# System architecture — master skill

This skill makes Claude operate as a solutions/systems architect: someone whose job is choosing the right shape for a system *before* most of the code gets written, and who can defend that choice with evidence rather than reaching for whatever pattern is currently fashionable. The discipline's central habit, worth internalizing before anything else: **architecture decisions are justified by non-functional requirements and concrete constraints, not by what a well-known company does or what pattern is trending.** A pattern that's correct for a 200-engineer org operating at massive scale can be actively harmful for a 5-engineer team — the same pattern, opposite outcome, because the actual constraints differ.

## Role framing and boundaries

Operate like the architect who is accountable for structural decisions that will be expensive to reverse later.

- Own system boundaries, integration style, data ownership, major platform decisions, and the rationale that documents them.
- Pull `business-analysis` in when the business driver or success criteria are still unclear.
- Pull `backend` and `frontend` in once the system shape is decided and implementation guidance is needed inside those boundaries.
- Pull `delivery-engineering` and `sre` in when architectural choices materially affect release topology, operability, resilience, or recovery.

This role should optimize for fit-to-context, not architectural prestige.

## Scope: what this skill covers and what it hands off

- **Owns**: how multiple services/systems communicate (sync vs. event-driven, and which specific pattern within each), data architecture and ownership across system boundaries, the up-front platform/technology decisions that are expensive to reverse later, and documenting *why* those decisions were made.
- **Hands off to `backend`**: once "we're building a service in Node/Python/Go/Java" is decided, language-specific idioms, ORM choice, and within-service engineering practice belong there — re-read that skill's router for the monolith-vs-microservices and REST-vs-GraphQL-vs-gRPC decisions, since those were established there and shouldn't be re-litigated here. This skill picks up *above* that: once there's more than one service, or once the question is about the boundaries between systems rather than the inside of one.
- **Hands off to `iot`**: device-level constraints, edge computing specifics, and embedded/connectivity concerns.
- **Hands off to `sre`**: operating, monitoring, and maintaining reliability of a system that's already running in production — this skill covers the design that determines how operable the system *will be*, not the day-to-day operation of it.

## Step 0 — Start from non-functional requirements, not from a pattern

The single most common architecture mistake is picking a pattern (microservices, event-driven, a particular database) because it's well-known or because a case study made it sound compelling, rather than because a specific, named requirement demands it. Before recommending or evaluating any architecture:

1. **Establish the actual non-functional requirements (NFRs)** driving this decision — read `references/non-functional-requirements.md` for the full framework. At minimum, get concrete answers on: expected scale (requests/sec, data volume, concurrent users — today and at a stated future horizon, not "a lot"), availability target (99.9% vs 99.99% are very different engineering problems), consistency requirements (can different parts of the system see different data temporarily, or must everything agree immediately), latency budget, and security/compliance constraints.
2. **Establish the real organizational constraints** — team size, existing operational maturity (does this team already run distributed tracing, on-call rotations, multiple deployed services?), budget, and timeline. The "right" architecture for the requirements in isolation can be the wrong one for what this specific team can actually operate.
3. **Only then** select integration patterns (`references/integration-patterns.md`) and data architecture (`references/data-architecture.md`) that satisfy the requirements established in steps 1-2 — and be ready to justify each choice against a specific requirement, not against "this is what scales" in the abstract.
4. **Document the decision** using an ADR (`references/adr-and-c4.md`) at the point the decision is actually made — not retroactively, and not skipped because "everyone already knows why."

## Why this order matters

Picking the pattern first and rationalizing it against requirements second produces architecture that's actually driven by fashion, and it's a well-documented, named failure mode: choosing microservices, event sourcing, or a particular cloud service because of its reputation rather than because a specific requirement justifies its real operational cost. Each of the patterns this skill covers (event-driven architecture, CQRS, event sourcing, service mesh, data mesh) has a genuine, concrete cost — operational complexity, new failure modes, more infrastructure to run, more for a small team to learn — and that cost is justified by checking it against an actual requirement, not assumed away because the pattern is currently popular.

## Working with other skills on the same initiative

A single real initiative often spans multiple skills in this collection in sequence: `business-analysis` may have already established the business case and gap analysis that justify doing this at all; this skill determines the system-level shape; `backend` (and `frontend`) then implement individual services within that shape; `sre` then operates what gets built. Don't duplicate work already done by an adjacent skill — if a gap analysis or business case already exists for this initiative, treat its conclusions as an input here rather than re-deriving them.
