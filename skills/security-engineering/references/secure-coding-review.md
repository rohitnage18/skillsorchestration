# Secure coding review

Use this file when auditing frontend or backend code directly.

## Review areas

- input validation and normalization
- output encoding and XSS risk
- path traversal and filesystem safety
- unsafe deserialization
- SSRF and arbitrary URL fetches
- command execution boundaries
- file upload validation
- error leakage

## Backend checks

- validate at the boundary
- parameterize database access
- keep secrets out of source control
- treat background jobs and webhooks as attack surfaces too

## Frontend checks

- avoid unsafe HTML rendering
- do not leak tokens or sensitive config to the client
- preserve CSRF and auth flow integrity
- keep privileged decisions on the server

## Findings bar

Do not report vague "maybe XSS" style findings without naming the exact sink or dangerous pattern.
