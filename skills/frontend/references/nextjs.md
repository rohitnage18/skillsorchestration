# Next.js - framework reference

Read this when the frontend task specifically uses Next.js rather than generic React alone. Use it alongside `react.md`, not instead of it.

## Default posture

- Prefer the App Router for new work.
- Prefer Server Components by default.
- Push client boundaries as deep as possible.
- Keep routing, data fetching, caching, and mutations aligned with Next.js primitives before introducing extra abstraction.

## Routing and file conventions

Use the framework's routing model deliberately:

- `page.tsx` for route entry
- `layout.tsx` for persistent layout shells
- `loading.tsx` for route-level suspense states
- `error.tsx` for route-level error boundaries
- `not-found.tsx` for missing resources
- route groups like `(marketing)` when URL and layout concerns should differ
- dynamic segments like `[id]` only when the URL truly models resource identity

Do not flatten everything into one large `app/` directory without feature structure.

## Data fetching and caching

- Fetch on the server by default.
- Use direct server-side data access when possible instead of making your own internal HTTP hop.
- Be explicit about caching behavior rather than assuming defaults are correct for every route.
- Use `revalidate`, route segment config, or explicit `fetch` cache options when freshness matters.

A common anti-pattern is calling your own API route from a Server Component when the same server can read the database or service directly.

## Mutations

Prefer Server Actions for form-style mutations when the project already uses App Router and the mutation naturally belongs close to the UI.

Use API routes when:

- the endpoint must also serve non-browser clients
- the interface is shared across multiple frontends
- the project already has a stable API boundary that should stay independent

Do not create both a Server Action and an unnecessary duplicate API route for the same simple mutation without a clear reason.

## Forms

- Keep validation shared between client and server when possible.
- Use `zod` schemas as the single source of truth for non-trivial forms.
- Return clear field and form-level errors.
- Preserve pending/disabled UI states during submission.

## Rendering strategy

Choose deliberately per route:

1. static when content changes rarely
2. server-rendered when freshness matters
3. streamed when part of the page is slow
4. client-heavy only when interaction density truly requires it

Do not mark a whole page `'use client'` because one child needs interactivity.

## Authentication and protected routes

- Enforce auth on the server where possible.
- Treat middleware as a routing gate, not the whole authorization model.
- Keep object-level authorization checks in server code, not only in UI visibility rules.

## Performance specifics

- Use `next/image` unless there is a concrete reason not to.
- Use `next/font` for font loading.
- Lazy-load heavy client features with `next/dynamic`.
- Watch bundle growth when adding editor, charting, or drag-and-drop libraries.

## Review anti-patterns

- internal API fetches from Server Components without need
- top-level `'use client'` on route files
- unclear caching/freshness behavior
- duplicate mutation paths through both actions and API routes
- middleware used as a substitute for real authorization
