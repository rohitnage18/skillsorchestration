---
name: backend
description: Use this skill for ANY backend/server-side work — building, reviewing, or advising on APIs, server architecture, databases, authentication, background jobs, or business logic that runs outside the browser. Trigger this whenever the user mentions Node.js, Express, Fastify, NestJS, Python, FastAPI, Django, Flask, Go, Gin, Java, Spring Boot, REST, GraphQL, gRPC, databases, ORMs, microservices, monoliths, server architecture, API design, authentication/authorization, or backend performance/scaling. Also trigger for requests like "build me an API", "design the backend for X", "review my server code", "why is this endpoint slow", "how should I structure my database", or "should this be a microservice" — even if no language is named. This is a comprehensive backend authority covering architecture decisions, language-specific idioms, databases, security, and testing — not just "write an endpoint."
---

# Backend — master skill

This skill makes Claude operate as a senior/staff-level backend engineer: someone who thinks about correctness, security, and operability with the same seriousness as raw functionality. Most backend help defaults to "here's an endpoint that works" without considering what happens at scale, under concurrent load, when a dependency is down, or when an attacker tries something unexpected. This skill is explicitly trying to never settle for "works on the happy path."

This skill does not cover frontend/client-side code (see the `frontend` skill), infrastructure/deployment/cloud topics like Kubernetes, Terraform, or CI/CD pipelines (see `system-architecture`), or IoT-specific protocols and constraints (see `iot`). Stay focused on the server-side application logic, its data layer, and the API surface it exposes.

## Step 0 — Determine architecture, then language (in that order)

Architecture decisions are largely language-agnostic and should be made *before* picking a language/framework — get this backwards and the language choice anchors thinking around the wrong shape.

### 0a. API style — who's calling this, and how often?

Don't pick a style because it's trendy; pick it because it matches the actual callers. **REST is the correct default in the large majority of cases** — it has the deepest tooling, the most universal understanding across teams, and native HTTP caching that the alternatives don't get for free. Reach for something else only when there's a specific reason:

| Situation | Default to |
|---|---|
| Public API, partners/third-party developers, simple CRUD, anything caching-sensitive | **REST** — the correct default unless there's a specific reason otherwise |
| Multiple client types (mobile/web/partner) with genuinely different data shape needs from the same underlying data | **GraphQL** — solves real over-fetching/under-fetching, but adds real complexity (resolvers, N+1 query problems, schema design discipline) — don't add it just because over-fetching feels inelegant if it isn't actually causing a measured problem |
| Internal service-to-service communication, especially high-throughput or latency-sensitive paths | **gRPC** — meaningfully faster (binary Protobuf vs JSON) and strongly typed, but has limited browser support and is overkill for a small team without prior gRPC experience |
| Genuinely unsure / small project, single client | **REST** — it's the boring, safe choice, and boring is usually correct here |

These aren't mutually exclusive across one system — a common, well-regarded real-world pattern is gRPC internally between services, with a REST or GraphQL layer exposed externally. Don't assume a single style must apply everywhere.

### 0b. Monolith, modular monolith, or microservices?

**Default to a modular monolith** unless there's a concrete, named reason not to. This isn't a compromise position — current consensus, including from teams that previously over-rotated toward microservices, is that the majority of organizations are better served by a single deployable unit with strict internal module boundaries than by a distributed system.

- **Start here**: a modular monolith — one deployment unit, but organized into modules with clear boundaries and explicit interfaces between them (treat module interfaces as real contracts, the same discipline as an API contract between services).
- **Stay here** unless a *specific, concrete* technical or organizational pressure shows up: a module needs genuinely independent scaling (e.g. one component needs GPU infrastructure the rest of the app doesn't), a module has a hard compliance/isolation requirement (e.g. PCI scope), or there are multiple large teams that need to deploy independently without coordinating releases.
- **When that pressure appears**, extract just that module into its own service — because module boundaries and data separation were already clean, this is a targeted extraction, not an untangling exercise. This is sometimes called the Strangler Fig approach: migrate incrementally, not as a big-bang rewrite.
- **Never choose microservices because they're fashionable or because a large company famous for them uses them.** That mismatch between team size/maturity and architectural complexity is a well-documented, named failure mode, not a hypothetical risk. A small team taking on a distributed system's operational burden (network failures, distributed tracing, eventual consistency, deployment coordination) without the org size or DevOps maturity to support it pays a real ongoing cost for a benefit they don't yet need.
- **Full microservices are the right call** when independent team autonomy at real scale, independent deployability across many teams, or genuinely divergent scaling/technology needs across components are actual current requirements — not anticipated future ones.

### 0c. Sync request/response or event-driven?

- **Synchronous (request waits for response)** is the default for anything where the caller needs an immediate answer — most CRUD operations, most user-facing API calls.
- **Event-driven / async (message queue, pub/sub)** is the right call for: long-running work that shouldn't block a request (sending emails, processing uploads, generating reports), decoupling producers from consumers that shouldn't need to know about each other, or workloads with bursty load that benefit from a buffer. Don't reach for a message queue just to feel more "scalable" — it adds real operational complexity (delivery guarantees, ordering, dead-letter handling) that needs to be justified by an actual async use case.

### 0d. Now pick the language/stack

Once the architecture shape is clear, check for existing signals (an open project with a `package.json`/`requirements.txt`/`go.mod`/`pom.xml` already answers this) before asking. If genuinely new work and unclear, ask directly:

| Stack | Strong fit when |
|---|---|
| **Node.js / TypeScript** | Team already does JS/TS on the frontend (shared types/tooling), I/O-heavy workloads, fastest ecosystem for REST/GraphQL APIs |
| **Python** | Data science / ML integration needed, team prioritizes readability and iteration speed, FastAPI for modern async APIs |
| **Go** | High-throughput services, gRPC-heavy systems, teams that want a small, fast, single-binary deployable with minimal runtime overhead |
| **Java** | Large enterprise teams, existing JVM infrastructure, Spring ecosystem maturity, strict typing and tooling at scale |

Once the stack is chosen, read the matching file in `references/` before writing code — it covers framework choice, idioms, ORM/database patterns, concurrency model, and testing tools specific to that language, current as of 2026 rather than relying on general training knowledge alone.

| Stack chosen | Read this file |
|---|---|
| Node.js / TypeScript | `references/nodejs.md` |
| Python | `references/python.md` |
| Go | `references/go.md` |
| Java | `references/java.md` |

If the task spans two stacks (e.g. a polyglot microservices system, or migrating one service to another language), read both relevant files.

## Step 1 — Non-negotiable engineering bars

These apply regardless of language or architecture. A backend that's "feature complete" but fails these isn't actually finished.

### Security
- **Validate and sanitize all input at the boundary** — never trust client-supplied data, including data that "should" already be validated by the frontend. The backend is the actual trust boundary.
- **Parameterized queries / ORM query builders only** — never string-concatenate user input into a SQL query, regardless of language. This is the single most common, most damaging, and most preventable class of backend vulnerability.
- **AuthN vs AuthZ, both required**: authentication (who is this) is not authorization (what are they allowed to do). Check both, explicitly, on every protected endpoint — don't assume a logged-in user is automatically authorized for the specific resource they're requesting (a classic and common bug: object-level authorization missed even though session auth is correct).
- **Secrets never in source control** — environment variables or a secrets manager, not hardcoded values, not committed `.env` files.
- **Rate limiting and input size limits** on any publicly exposed endpoint, to bound the damage a single bad actor or bad client can do.
- Treat dependency vulnerabilities seriously — check for known CVEs in major frameworks/libraries being used (the same way the `frontend` skill flags React's CVE-2025-55182) rather than assuming a popular package is automatically safe.

### Data integrity
- Define a clear schema and enforce it at the database level (constraints, foreign keys, not-null) in addition to application-level validation — application validation alone is bypassable by a direct DB write, a migration bug, or a second service touching the same data.
- Use transactions for any multi-step operation that must succeed or fail as a unit — don't leave data in a half-updated state if step 2 of 3 fails.
- Plan migrations to be reversible and zero-downtime where possible — a migration that locks a large table or can't be rolled back is a production incident waiting to happen.

### Performance & scalability
- Identify the actual bottleneck before optimizing — N+1 query problems (especially common in GraphQL resolvers and ORMs) are the single most common avoidable backend performance issue.
- Add database indexes deliberately, based on actual query patterns — not as an afterthought, and not by indexing everything (which has its own write-performance cost).
- Cache deliberately, with a clear invalidation strategy decided *before* the cache is added — an unclear invalidation story is how stale-data bugs happen.
- Design for horizontal scaling where it's plausible the service will need it: keep the application layer stateless (session data in a shared store, not in-process memory) so multiple instances can run behind a load balancer.

### Testing
- Unit test business logic in isolation from the database/network where possible.
- Integration test the actual data layer (against a real or realistic test database, not just mocks) for anything with non-trivial queries.
- Test failure paths explicitly — what happens when a downstream dependency times out, when a malformed payload arrives, when a unique constraint is violated — not just the success path.
- Critical flows (auth, payments, anything with financial or legal consequence) get the most thorough test coverage, proportional to the cost of them failing in production.

### Observability
- Structured logging (not raw string concatenation) so logs are actually queryable in production.
- Meaningful error messages returned to callers (without leaking internals like stack traces or DB schema details) and full detail captured server-side for debugging.
- Health check endpoints for anything that will run behind an orchestrator or load balancer.

## Step 2 — When reviewing existing code (not building new)

1. Identify the stack and architecture from what's present — don't ask if it's obvious from the files.
2. Read the matching `references/` file for that stack's specific idioms and anti-patterns.
3. Check the Step 1 bars explicitly — security and data-integrity issues are easy to miss in a review focused only on "does the endpoint return the right JSON."
4. Distinguish a stylistic preference from an actual bug, security issue, or architectural problem — don't rewrite someone's working code to match personal taste when they asked for a specific fix.
