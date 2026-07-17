# API design

Use this file when shaping HTTP, GraphQL, or RPC-facing contracts.

## Core design checks

- make resource or operation boundaries explicit
- keep naming consistent across routes, payloads, and status codes
- separate external contract stability from internal implementation freedom
- decide pagination, filtering, sorting, and idempotency rules deliberately

## Error model

A good API should define:

- validation error shape
- auth/authz failure behavior
- not-found semantics
- conflict/update-race semantics
- retry-safe versus non-retry-safe operations

## Versioning guidance

- prefer additive change where possible
- version only when contract breakage is real
- document deprecation behavior before removing fields or endpoints

## Review bar

If a client team could not predict how a similar endpoint should behave, the API surface is not consistent enough yet.
