# Test scenario catalog

Use this file when auditing a complete project or when the user asks for broad scenario coverage.

## Build the scenario list

For each major feature, enumerate scenarios in this order:

1. happy path
2. invalid input
3. boundary values
4. empty state
5. loading / retry state
6. error / timeout / dependency failure
7. duplicate or repeated action
8. interrupted flow
9. role or permission mismatch
10. regression combinations with related features

## Functional areas to check

### Authentication and identity

- sign up, sign in, sign out
- invalid credentials
- expired session
- role-based visibility
- unauthorized direct URL access
- account state changes like disabled or pending users

### CRUD and workflow behavior

- create, read, update, delete
- partial updates
- duplicate creation attempts
- concurrent edits when relevant
- cancel or back-out behavior
- persistence after refresh or restart

### Data integrity

- required fields
- field formats
- max/min limits
- sorting and filtering
- search behavior
- import/export correctness
- audit log or history side effects

### Notifications and side effects

- email sent, skipped, retried, failed
- in-app notification state
- repeated trigger behavior
- user-visible success/failure messaging

### Admin and privileged flows

- least-privilege access
- approval and rejection paths
- restore, delete, disable, reactivate flows
- sensitive actions recorded in logs

### Frontend quality

- responsive layout at small and large breakpoints
- keyboard navigation
- focus visibility
- form labels and validation feedback
- empty and error UI states

### Backend and integration quality

- malformed payloads
- missing records
- downstream failure behavior
- retry/idempotency behavior
- unsafe trust in client input

### Reliability and resilience

- restart or refresh recovery
- partial failure handling
- observability signals present
- meaningful errors without leaking internals

## Coverage rule

Do not claim full coverage unless you can name the features tested, the scenario classes exercised, and the notable gaps that remain.
