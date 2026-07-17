# Orchestration and observability

Use this file when pipelines need scheduling, retries, monitoring, or operational confidence.

## Orchestration checks

- task boundaries and dependency order
- retry semantics
- backfill behavior
- idempotency expectations
- failure notification paths

## Observability checks

- run-level status visibility
- row-count or volume tracking
- freshness tracking
- error categorization
- lineage or impact visibility for downstream consumers

## Practical rule

If a failed pipeline run would require guesswork to know what succeeded, what failed, and what to replay, the operational design is too weak.
