# Node.js / TypeScript — stack reference

Read this after Step 0 of `SKILL.md` has determined the architecture shape (API style, monolith vs. services, sync vs. event-driven) and that Node.js/TypeScript is the chosen language. This file covers framework choice, runtime choice, the database/ORM layer, and idioms specific to this ecosystem. The Step 1 engineering bars in `SKILL.md` still apply — this file adds the Node-specific *how*.

## Framework choice — there is no single default here

Unlike some other stacks, Node.js backend frameworks genuinely split along different axes rather than converging on one obvious choice. Pick based on the actual constraint, not familiarity alone:

| Framework | Choose when |
|---|---|
| **Fastify** | Building a standalone Node API and want Express-like ergonomics with real performance (2-3x Express throughput) and built-in JSON Schema validation/serialization. The sensible default for a new, plain REST API with no other strong constraint. |
| **NestJS** | Team of 3+ developers, long-lived backend where conventions matter, want enterprise architecture with dependency injection and a large ecosystem of first-party modules (auth, GraphQL, microservices). Familiar to anyone coming from Angular or .NET. Heavier to set up than the alternatives — that's the trade-off for the structure it provides. |
| **Hono** | Deploying to edge runtimes (Cloudflare Workers, Vercel Edge, Deno) or want the smallest, fastest framework with tight TypeScript type inference. Built on Web Standards (`Request`/`Response`) rather than Node-specific APIs, so the same code runs across Node, Bun, Deno, and edge platforms without modification. The right call for serverless functions where cold start matters. |
| **Express** | Maintaining an existing Express codebase, the team relies heavily on Express-specific middleware with no equivalent elsewhere, or there's a hard deadline and the team already knows Express well. Don't start a brand-new project on Express by default in 2026 purely out of habit — it has real, measurable per-request overhead compared to the alternatives, and hasn't had a major release in years (Express 5 changed this somewhat — see below). |

**For existing NestJS projects**: NestJS v11 defaults to **Express v5** as its HTTP adapter, not v4. This is not a drop-in replacement — Express 5 changes route-wildcard syntax (the old bare `*` wildcard no longer works; named patterns like `*splat` are required now) and query-string parsing behavior. Check the Express major version before assuming v4 patterns will work, and check NestJS's `@nestjs/platform-fastify` package if the project wants NestJS's architecture with Fastify's performance underneath.

**Don't migrate an existing, working framework just because a newer one benchmarks better.** Framework migrations are expensive; only switch when there's real, current pain (a genuine performance ceiling being hit, or a hard requirement like edge deployment) rather than chasing benchmark numbers in isolation.

## Runtime: Node.js vs. Bun

This is now a genuine production decision, not just a Node-vs-experimental-toy question.

- **Node.js remains the safer default** for: revenue-critical systems with an on-call rotation, long-running processes (72+ hours, where Node's V8 garbage collector is more proven), anything depending on native C++ addons (`node-gyp`-based packages), or teams that need the largest hiring pool and the most mature APM/observability tooling.
- **Bun is a legitimate, increasingly common choice** for: serverless/edge functions (8-15ms cold starts vs. Node's 40-120ms is a real, material difference when cold starts are billed or affect UX), new greenfield projects without legacy native-addon dependencies, and CLI/tooling work where Bun's install speed and built-in test runner are a genuine productivity win.
- **Worth knowing**: Anthropic acquired Bun's creator company in December 2025, specifically to support Claude Code's infrastructure — Bun remains open-source and MIT-licensed with the same team continuing development in public. This meaningfully addresses the "will this still be maintained in five years" concern that previously made Bun a riskier bet for production.
- **The pragmatic hybrid, common in practice**: use `bun install`/`bun test` for development speed in CI and locally, while still running production on Node.js — this captures Bun's tooling-speed benefits without taking on production runtime risk. This is a reasonable default recommendation when there's no specific pressure toward one extreme.
- Always test the actual dependency tree before committing to Bun in production — native addons and Node-internal APIs (`node:inspector`, `node:repl`) remain the main compatibility gaps.

## Database / ORM layer

| Tool | Choose when |
|---|---|
| **Prisma** | Traditional Node backend on a long-running server/container (not edge), team wants the most polished DX, migrations handled declaratively, and access to Prisma Studio for visual data inspection. Still the most widely adopted TypeScript ORM and the safer onboarding choice for developers less comfortable with raw SQL. As of Prisma 7 (late 2025), the old Rust query engine binary was replaced with a TypeScript/WASM implementation — this closed most of the previous edge/serverless disadvantage, so "Prisma can't run on the edge" is no longer accurate, though Drizzle still has the edge in that specific scenario. |
| **Drizzle** | Edge/serverless deployment (Cloudflare Workers, Vercel Edge, Lambda), team is comfortable thinking in SQL and wants a thin, transparent query builder rather than an abstraction layer, or minimal bundle size/cold-start time matters. No code-generation step — types update immediately as the TypeScript schema file is edited, which meaningfully speeds up the development loop compared to Prisma's `prisma generate` step. |
| **TypeORM** | Generally avoid for new projects — it's considered legacy in the TypeScript ecosystem as of 2026. Only continue using it on an existing codebase already built on it, not as a choice for new work. |

**For an existing project, don't migrate ORMs without real pain.** Both Prisma and Drizzle are mature enough now that the choice matters less than it did a few years ago for typical CRUD workloads — the performance difference shows up mainly in serverless cold-start scenarios and very high QPS with heavy connection pooling, not in ordinary application code.

```ts
// Drizzle — schema lives in plain TypeScript, no generation step
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});
```
```ts
// Prisma — schema in a separate DSL file, generates a typed client
// schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
}
```

**Regardless of ORM choice**: never string-concatenate user input into a query — both Prisma and Drizzle offer safe parameterized raw-query escape hatches (`$queryRaw` with tagged templates in Prisma, `sql` template tag in Drizzle) for the cases the query builder can't express, and these should be used instead of manual string building whenever raw SQL is genuinely necessary.

## Concurrency model

Node's single-threaded event loop with non-blocking I/O is the foundational mental model — CPU-bound work blocks the event loop for *everyone*, not just the current request, which is the most common way a Node service degrades under load without an obvious cause.

- Never run CPU-intensive synchronous work (heavy computation, synchronous crypto, large synchronous JSON parsing) directly on the main thread in a request handler — offload it to a `worker_thread` or a separate process/queue.
- Use `async`/`await` consistently; avoid mixing callback-style and Promise-style code in the same codebase without a clear boundary, since inconsistent error-propagation patterns here are a common source of unhandled-rejection bugs.
- For background/long-running work (sending emails, processing uploads, generating reports — the event-driven case flagged in `SKILL.md` Step 0c), use a real queue (BullMQ on Redis is a common, well-supported choice) rather than firing off an unawaited async function and hoping it completes before the process exits.

## Testing

- **Vitest** is the current standard for unit and integration tests in new TypeScript projects — faster than Jest, ESM-native, and the same tool used across the modern JS ecosystem (it's also what the `frontend` skill's React/Vue/Svelte files standardize on, which keeps tooling consistent across a full-stack team).
- Test the actual data layer against a real or realistic test database for anything with non-trivial queries — mocking the ORM entirely hides real SQL bugs (bad joins, missing indexes surfacing as N+1 patterns) that only show up against a real database engine.
- For HTTP-level integration tests, exercise the actual framework's request/response cycle (e.g. Fastify's `.inject()`, or a real HTTP client against a test server instance) rather than only unit-testing handler functions in isolation — this catches middleware ordering bugs and serialization issues that pure unit tests miss.
- Bun's built-in test runner (`bun test`) is Jest-compatible enough that most existing Jest test suites need only minor import changes to run under it — relevant if evaluating a Bun migration, since test-suite portability is usually the least risky part of that move.

## Anti-patterns to flag in review

- String-concatenated SQL anywhere, regardless of ORM availability.
- CPU-bound synchronous work running directly in a request handler, blocking the event loop for all concurrent requests.
- Fire-and-forget async calls for anything that matters (sending an email, writing an audit log) with no error handling and no retry — if the process exits or the promise rejects silently, the work is just lost.
- Starting a brand-new project on Express in 2026 purely from habit, without considering Fastify's near-identical ergonomics at meaningfully better performance.
- Assuming Express 4 wildcard route syntax works unchanged after a NestJS upgrade that pulled in Express 5.
- Migrating a working Prisma or Drizzle setup to the other ORM chasing a marginal benchmark difference rather than a real, current pain point.
- Choosing TypeORM for a new project in 2026.
