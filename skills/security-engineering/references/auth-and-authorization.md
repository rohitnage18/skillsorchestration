# Auth and authorization

Use this file when reviewing login, roles, sessions, admin pages, or protected APIs.

## Review priorities

- who can sign in
- how sessions are established
- where authorization is checked
- whether object-level access is enforced
- whether admin-only actions are actually server-protected

## Common high-risk failures

- trusting client-side role checks alone
- authenticated user can act on another user's resource
- hidden admin UI but no server-side admin enforcement
- weak callback or redirect handling in OAuth flows
- inconsistent auth checks between page loads and API routes

## Verification prompts

- Can a normal user call the admin API directly?
- Can one user read or update another user's data by changing an ID?
- Does session state survive in an unsafe or overly trusted way?
- Are audit-sensitive actions logged?
