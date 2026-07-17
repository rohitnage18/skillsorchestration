# Mobile auth and offline behavior

Use this file when the app involves login, token storage, sync, or intermittent connectivity.

## Review areas

- secure credential or token storage
- session expiry and refresh behavior
- offline reads versus offline writes
- retry and conflict handling
- user-visible sync state

## Good defaults

- be explicit about what works offline and what does not
- avoid silent data loss on reconnect
- surface actionable messaging when auth expires or sync fails
- test login and resume flows after the app is backgrounded

## Practical rule

If a user can create or edit data offline but the app has no clear conflict or retry behavior, the mobile experience is not ready.
