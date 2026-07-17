# Auth and session patterns

Use this file when the backend task involves login, sessions, tokens, roles, or permissions.

## Review areas

- authentication boundary
- authorization boundary
- session storage model
- token lifetime and rotation
- CSRF exposure where cookie auth is used
- object-level authorization checks

## Good defaults

- keep privileged decisions on the server
- check authorization per resource, not only per route group
- make session invalidation and logout behavior explicit
- avoid leaking sensitive claims or secrets into client-visible payloads

## Practical rule

If the system can confirm who the user is but not what they are allowed to do on a specific resource, auth is incomplete.
