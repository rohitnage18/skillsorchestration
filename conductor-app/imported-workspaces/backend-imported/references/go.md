# Go — stack reference

Read this after Step 0 of `SKILL.md` has determined the architecture shape and that Go is the chosen language. This file covers framework choice, the database layer (which splits philosophically more than in other ecosystems), error handling and concurrency idioms, and testing conventions. The Step 1 engineering bars in `SKILL.md` still apply — this file adds the Go-specific *how*.

## Framework choice

Go's standard library `net/http` is genuinely capable on its own — frameworks here add convenience (routing, middleware, validation), not a fundamentally different programming model the way they might elsewhere. This makes "do we even need a framework" a real first question, not just a formality.

| Framework | Choose when |
|---|---|
| **Gin** | The safest, most broadly-supported default. Most-used Go web framework (roughly 48% adoption per recent ecosystem surveys), runs on standard `net/http` (so HTTP/2 support comes free from the standard library), large middleware ecosystem, extensive documentation and community examples. Pick this when there's no specific reason to pick something else. |
| **Echo** | Want a cleaner, more idiomatic API than Gin's — Echo returns errors from handlers rather than relying on Gin's context-based panic/recover pattern, which many Go developers find more natural. Also built on `net/http`. Slightly smaller ecosystem than Gin, but excellent documentation. |
| **Fiber** | Raw HTTP throughput is a genuinely measured bottleneck, or the team is transitioning from Express.js/Node.js and wants familiar ergonomics. Built on `fasthttp`, not `net/http` — this is the important trade-off: **no native HTTP/2 support**, and the broad ecosystem of standard Go middleware doesn't work directly (Fiber-specific middleware or an adapter with overhead is required). Don't pick Fiber by default; pick it when its specific performance profile is the actual reason. |
| **Chi** | Want a lightweight router that stays close to the standard library, with clean architecture and minimal framework lock-in. A good fit for teams that want structure without committing to a heavier framework's opinions. |
| **Plain `net/http`** (with Go 1.22+'s improved built-in routing) | A single, fairly simple service where pulling in a framework adds little. Go's standard library router has improved enough in recent versions that this is a more viable "no framework" choice than it used to be. |

**Avoid Gorilla/mux for new projects.** It's still seen in older codebases (17% of developers per recent surveys) but the original team stopped maintaining it in November 2023 — community forks continue it, but new projects should default to Chi or the standard library's own routing instead.

**Don't default to Fiber for a new project just because it benchmarks fastest.** The HTTP/2 and middleware-ecosystem trade-offs are real costs; pay them only when the throughput need is concrete and measured, not anticipated.

## Database layer — a genuine philosophical split, more than other ecosystems

Go's database tooling doesn't converge on one obvious default the way some other stacks do — there's a real, ongoing split between "write SQL, generate type-safe Go" and "write Go, let the library generate SQL." Both are legitimate; pick deliberately.

| Tool | Philosophy | Choose when |
|---|---|---|
| **sqlc** | Write SQL in `.sql` files, generate fully type-safe Go functions from it. No runtime reflection, no abstraction over what query actually runs. | Team is comfortable with and prefers writing real SQL, performance matters, want compile-time safety without an ORM's runtime magic. The right fit for microservices with focused, well-understood database interactions. |
| **GORM** | Code-first: define Go structs with tags, GORM translates method calls into SQL. Active Record-style patterns familiar to Rails/Django developers. | Rapid prototyping, complex relational models (has-many, belongs-to, many-to-many) where GORM's association handling saves real time, team prioritizes Go-idiomatic code over hand-written SQL, junior developers need to be productive quickly without deep SQL knowledge. |
| **sqlx** | A thin wrapper over `database/sql` — adds convenient struct scanning without going as far as a full ORM or code generation. | Want something lighter than GORM but don't want sqlc's code-generation step; comfortable writing SQL strings directly. |
| **ent** | Code-first like GORM, but statically typed with a steeper learning curve; built for complex data models and relationships with stronger compile-time guarantees than GORM. | Complex domain model where type safety on relationships specifically matters enough to justify the learning curve. |

**Be honest about GORM's known cost**: its query builder can generate suboptimal SQL for complex queries, and the **N+1 query problem is a real, common risk specifically around `Preload`** — fetching a collection of records and then lazily fetching each one's associations separately instead of in one join. Enable GORM's logger during development to see the actual SQL it generates; debugging "why is this endpoint slow" without that visibility is much harder.

**A legitimate hybrid, used in practice**: GORM for standard CRUD, sqlc for the small number of genuinely performance-critical queries. This works, but adds a real "which tool for which query" decision cost — don't introduce this hybrid casually; do it deliberately once a specific GORM-generated query is identified as a real bottleneck.

**Migrations**: if using sqlc, sqlx, or raw `database/sql`, pair with a dedicated migration tool — `golang-migrate` or `goose` are the standard choices. GORM has its own auto-migration feature built in, which is convenient for development but should be used cautiously in production — review what it will actually do to an existing schema before trusting it on a live database, same caution as Alembic's autogenerate in the Python stack.

```go
// sqlc — write the SQL, get a typed function
// query.sql
// -- name: GetUserByID :one
// SELECT id, email, created_at FROM users WHERE id = $1;

// generates: func (q *Queries) GetUserByID(ctx context.Context, id int64) (User, error)
```
```go
// GORM — define the struct, call methods
type User struct {
    ID        int64
    Email     string `gorm:"uniqueIndex"`
    CreatedAt time.Time
}
var user User
db.First(&user, id) // generates the SELECT for you
```

## Error handling

Go's explicit, no-exceptions error handling is foundational, not a stylistic option — code that fights this model tends to be harder for any Go developer (or AI assistant trained on idiomatic Go) to reason about correctly.

- **Always check returned errors immediately** — `if err != nil { return fmt.Errorf("doing X: %w", err) }` (or the handler/logging equivalent), not deferred or batched checking.
- **Wrap errors with context using `%w`**, not `%v` or string concatenation — this preserves the original error so callers can use `errors.Is`/`errors.As` to check for specific underlying error types, which string-flattening destroys.
- **Don't use panics for ordinary error flow.** Panics are for truly unrecoverable programming errors (e.g. an invariant violation that indicates a bug), not for expected failure cases like "the record wasn't found" or "the input was invalid" — those are errors, returned normally.
- **`defer` for cleanup, always paired with the resource it cleans up** — `rows, err := db.Query(...); defer rows.Close()` immediately after the error check, not at the end of a long function where it's easy to forget or misplace.
- Sentinel errors (`var ErrNotFound = errors.New("not found")`) or custom error types are both fine — pick based on whether callers need to distinguish error *kinds* (sentinel/typed) or just need a wrapped message for logging (plain wrapped error).

## Concurrency

- Goroutines and channels are the standard concurrency primitives — but **every goroutine you start needs a clear story for how it stops and how its errors surface**. A goroutine started with no way to signal completion or propagate an error is a common source of silent failures and goroutine leaks.
- Use `context.Context` for cancellation and deadlines, threaded through from the incoming request — a request handler that spawns work without passing its context down can't be cancelled when the client disconnects, wasting server resources on work nobody's waiting for anymore.
- `sync.WaitGroup` for waiting on a known set of goroutines to finish; buffered channels or `errgroup` (from `golang.org/x/sync/errgroup`) for collecting results/errors from concurrent work cleanly, rather than hand-rolling a mutex-protected slice for every case.
- Watch for the classic goroutine-closure-over-loop-variable bug in older Go code — this was fixed at the language level in Go 1.22 (each loop iteration now gets its own variable), but code targeting earlier Go versions, or copied from older tutorials, may still need the explicit `i := i` workaround.

## Testing

- **Table-driven tests are the idiomatic Go pattern** for testing a function against multiple input/output cases — a slice of structs (input, expected output, test name) iterated with `t.Run(tc.name, func(t *testing.T) {...})` for each case, rather than one test function per case.
- The standard library's `testing` package, plus `httptest.NewRequest`/`httptest.NewRecorder`, is sufficient for testing Gin and Echo handlers — both work directly with their respective context types over these standard helpers. Fiber needs its own test utilities because it's built on `fasthttp` rather than `net/http`.
- For database-touching tests, spin up a real (often containerized, via `testcontainers-go`) instance of the actual database engine for integration tests — same principle as every other stack in this skill: mocking the database entirely hides real query bugs.
- Use `go test -race` regularly, not just occasionally — Go's race detector catches concurrent-access bugs that won't necessarily show up in normal test runs but will eventually surface in production under real concurrent load.

```go
// table-driven test — the idiomatic pattern
func TestValidateEmail(t *testing.T) {
    cases := []struct {
        name  string
        input string
        want  bool
    }{
        {"valid", "user@example.com", true},
        {"missing at", "userexample.com", false},
        {"empty", "", false},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            got := ValidateEmail(tc.input)
            if got != tc.want {
                t.Errorf("ValidateEmail(%q) = %v, want %v", tc.input, got, tc.want)
            }
        })
    }
}
```

## Anti-patterns to flag in review

- Ignoring a returned error (`_ = someFunc()` or simply not checking) for anything other than a deliberate, commented decision that the error truly doesn't matter.
- Using `%v` instead of `%w` when wrapping errors, losing the ability for callers to unwrap and check the underlying error type.
- A goroutine started with no cancellation path and no error-reporting mechanism.
- Choosing Fiber for a new project without a concrete, measured throughput requirement driving that choice.
- New code built on Gorilla/mux without acknowledging it's unmaintained upstream.
- GORM's `Preload` used inside a loop instead of in the original query, recreating the N+1 problem GORM's association features are supposed to avoid.
- Auto-migration (GORM) run against a production database without first reviewing what it intends to change.
- Panic used for expected, recoverable error conditions instead of a returned error.
