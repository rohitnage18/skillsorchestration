# Data modeling and migrations

Use this file when designing schemas or changing persisted data.

## Modeling checks

- make entity boundaries and ownership explicit
- choose keys deliberately
- enforce constraints in the database, not just application code
- identify high-cardinality or frequently-filtered fields that may need indexes

## Migration checks

- favor backward-compatible rollout steps where possible
- plan for rollback or safe forward-fix
- avoid long locks on large tables when alternatives exist
- define how existing data will be backfilled or normalized

## Integrity bar

If a failed halfway deployment could leave data in an ambiguous state, the migration plan is not ready.
