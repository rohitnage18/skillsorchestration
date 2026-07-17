# Pipeline patterns

Use this file when selecting ingestion and transformation approaches.

## Common patterns

- scheduled batch for periodic sync or analytics loads
- micro-batch for near-real-time with simpler operations than full streaming
- streaming for high-frequency or low-latency event flow
- CDC when source-of-record changes must be captured incrementally

## Selection guidance

- prefer batch unless latency requirements truly demand more
- prefer append plus compaction when mutation history matters
- use idempotent writes or merge logic for retry safety
- keep raw and curated layers separate

## Reliability bar

A good pipeline design should answer:

- how retries behave
- how backfills work
- how duplicates are handled
- how late-arriving data is treated
- how partial failure is detected
