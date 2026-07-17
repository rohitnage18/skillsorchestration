# React / Next.js — stack reference

Read this after Step 0 of `SKILL.md` has determined React is the chosen stack. This is the complete playbook for React work: architecture, rendering strategy, a verified security note, state management, performance, accessibility specifics, and testing. The aesthetic and engineering-bar principles in `SKILL.md` still apply — this file adds the React-specific *how*.

## Architecture: Server Components vs Client Components

Next.js App Router makes every component a Server Component by default. This is the foundational architectural decision for the whole tree, not a performance toggle to apply later.

**Mental model**: Server Components are the structure of a house — foundation and walls, built once, sent to the client only as rendered HTML, zero JS shipped. Client Components are the doors, switches, and outlets — the interactive bits, hydrated in the browser.

**Default to Server Components. Add `'use client'` only when a component needs:**
- React hooks tied to client lifecycle or state (`useState`, `useEffect`, `useReducer`, consuming `useContext`)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser-only APIs (`window`, `document`, `localStorage`, geolocation)

**Critical rule — push `'use client'` as deep as possible.** The directive marks a *boundary*, not a single component: every module that file imports becomes part of the client bundle. Marking a whole page `'use client'` because one button needs an `onClick` drags the entire tree into the client bundle and defeats the point. Extract the interactive piece into its own small file instead.

```tsx
// page.tsx — stays a Server Component, fetches data directly
import LikeButton from './like-button';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id); // direct DB/API call, no client round-trip
  return (
    <article>
      <h1>{post.title}</h1>
      <LikeButton initialLikes={post.likes} />
    </article>
  );
}
```
```tsx
// like-button.tsx — small, isolated client boundary
'use client';
import { useState } from 'react';

export default function LikeButton({ initialLikes }: { initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);
  return <button onClick={() => setLikes(likes + 1)}>♥ {likes}</button>;
}
```

**Common mistakes:**
- Marking everything client-side "just in case" — eliminates the entire benefit of RSC.
- Passing functions as props from a Server Component to a Client Component — functions aren't serializable across the boundary. Pass data, not behavior.
- Using React Context inside a Server Component — Context isn't supported there; wrap the consuming subtree in its own Client Component.
- Assuming `'use client'` is needed on every file in a feature — it operates at the module boundary; mark it once where client behavior begins, and everything imported from that point on is part of the client bundle automatically.

**When RSC is the wrong tool**: highly interactive, stateful UI (a canvas editor, Figma/Notion-style apps) where most of the tree is inevitably client-bound anyway; offline-first apps; constrained edge environments that can't assume reliable server access at render time. In these cases a traditional client-driven architecture is the right call — don't force RSC where interaction density defeats its purpose.

## Security: verified critical vulnerability — check this on every project

**CVE-2025-55182 ("React2Shell")** — a critical, unauthenticated remote code execution vulnerability in the React Server Components "Flight" protocol. Disclosed December 3, 2025, by Meta and Vercel, with a maximum CVSS score of 10.0. Actively and widely exploited within hours of disclosure by both opportunistic cryptominers and multiple nation-state-linked threat groups.

- **Affects**: React versions 19.0.0, 19.1.0, 19.1.1, and 19.2.0, and any framework built on RSC — most notably Next.js 15.x and 16.x using the App Router. Also affects React Router and Waku.
- **Not affected**: Next.js 13.x, 14.x stable, Pages Router applications, and the Edge Runtime.
- **Why it's especially dangerous**: it lives in the default configuration. A standard `create-next-app` project built for production could be exploited with no code changes by the developer — the flaw is in how the server deserializes RSC payloads, not in application code. The attack is a single unauthenticated HTTP request; no credentials needed.
- **Action on any React/Next.js project, new or existing**: check installed React and `react-server-dom-*` package versions against current patched releases. If on an affected version, upgrade immediately, clear `node_modules` and lockfiles, and do a clean reinstall (`npm ci` or equivalent) before redeploying.
- Treat this at Log4Shell-level severity when auditing or starting any RSC-based project — security researchers have explicitly drawn that comparison given the scale and ease of exploitation.
- This is a fast-moving, actively-patched area. If there's any doubt about current safe version numbers, verify against current advisories rather than trusting a fixed version cited from memory.

## Project structure

For App Router projects, organize by feature/route, not by file type:

```
app/
  (marketing)/           route group, no URL segment
    page.tsx
  dashboard/
    layout.tsx
    page.tsx
    loading.tsx          # auto-wraps in Suspense
    error.tsx             # auto-wraps in error boundary
    [id]/
      page.tsx
components/
  ui/                     # shadcn/ui primitives or design-system atoms
  <feature>/              # feature-specific composed components
lib/
  <domain>.ts             # business logic, pure functions
hooks/
  use-<thing>.ts
```

Avoid a flat `components/` dump of unrelated files, and avoid splitting every component into its own folder with barrel exports unless the project is large enough to need it.

## Rendering strategy decision

For every page/route, decide deliberately rather than defaulting to client rendering:

1. **Static generation** — no per-request data, or data that changes rarely. Fastest possible; cache aggressively.
2. **Server Component with server-side data fetching** — default for anything that reads data and doesn't need interactivity on first paint. No client JS shipped for this component.
3. **Server Component + Client Component leaf** — page shell and data fetching on the server, a small interactive island (`'use client'`) for the part that actually needs `useState`/event handlers.
4. **Full client rendering** — justify this explicitly. Appropriate for highly interactive, stateful UI where server rendering wouldn't help.

Never reach for `'use client'` at the top of a whole page because one button needs an `onClick`.

## State management — current decision tree

Match the tool to the *type* of state. The 2026 consensus is clear and worth following deliberately rather than picking one library for everything.

| State type | Default tool | Notes |
|---|---|---|
| Server/API data | **TanStack Query** | Handles caching, refetching, loading/error states, optimistic updates. Don't duplicate server data into a client store. |
| Shared client/UI state | **Zustand** | Crossed 50% adoption among React developers as of the 2025 State of React survey, and is the most-downloaded dedicated state library. Default for cross-component client state (sidebar open, locally-held filters, auth session reference). |
| Form state | **React Hook Form + Zod** | Zod schema doubles as runtime validation and TypeScript type source. |
| URL state | **`useSearchParams`** | Anything that should survive a refresh or be shareable (filters, pagination, active tab) belongs in the URL, not component state. |
| Local component state | **`useState` / `useReducer`** | The majority of state. Promote to global only once 2+ unrelated components actually need it. |
| Complex enterprise client state | **Redux Toolkit** | Justified by a large team (5+ devs, 15+ screens) needing enforced architecture, genuinely complex interconnected client state, or a real need for time-travel debugging. No longer the default starting point — most apps that think they need it actually need TanStack Query + Zustand. |
| Atomic/derived state | **Jotai** | When state is naturally a graph of small derived values rather than one store shape. |

**The current default stack for new projects**: TanStack Query (server state) + Zustand (client state) + URL state for anything shareable. This combination covers the large majority of real applications without over-engineering.

**Most common anti-pattern to flag in review**: fetching from an API, storing the result in Zustand/Redux, then manually keeping it in sync with `useEffect` + `setState`. That's TanStack Query's job — seeing this pattern is a clear signal to migrate it to a query hook.

## Performance specifics

- **Trust the React Compiler, verify when it matters.** Stable as of React 19, it handles memoization at build time. Manual `useMemo`/`useCallback`/`React.memo` should now be treated like a manual `for` loop in modern JS — usually unnecessary, occasionally still correct when a value crosses into a non-React boundary or needs precise referential stability for an external library. If a component renders more than expected, profile first (React DevTools Profiler) before reaching for a manual escape hatch; a wrong manual dependency array is a worse bug than a missed optimization.
- **Bundle discipline**: dynamic `import()` / `next/dynamic` for anything not needed on initial paint (modals, heavy charts, below-the-fold sections).
- **Images**: `next/image` by default — handles sizing, format negotiation (AVIF/WebP), lazy loading, and prevents the missing-dimensions cause of layout shift.
- **Fonts**: `next/font` for automatic self-hosting and zero-layout-shift font loading, rather than a render-blocking external `<link>`.
- **Streaming**: use `loading.tsx` / `<Suspense>` boundaries around slow data fetches so the shell paints immediately and slow parts stream in — don't block the whole page behind the slowest query.
- **Server Components reduce client bundle size directly** — a library used only for server-side work (markdown processing, heavy formatting) never ships to the client at all when it's only imported inside a Server Component.

## Accessibility specifics for React

- Don't reach for `<div onClick>` — use `<button>`. If a design genuinely needs a non-button clickable element, it needs `role="button"`, `tabIndex={0}`, and both `onClick` and `onKeyDown` (Enter/Space) handlers, but the semantic element is almost always better.
- Manage focus explicitly on route change and modal open/close — this isn't handled automatically. A modal opening should trap focus and return it to the trigger element on close.
- Prefer Radix UI primitives (which shadcn/ui is built on) for anything with non-trivial interaction patterns — dialogs, comboboxes, menus. They ship correct ARIA and keyboard behavior already solved; don't hand-roll keyboard navigation for a dropdown from scratch.
- Don't suppress `eslint-plugin-jsx-a11y` warnings — they catch missing `alt`, invalid ARIA usage, and missing keyboard handlers before they ship.
- Client Components that render content after hydration (spinners resolving, lazy content appearing) need `aria-live` regions if the appearance should be announced to screen reader users.

## Testing setup

- **Vitest** for unit tests: pure functions, Zod schemas, Server Actions tested as plain functions, and synchronous Client Components via React Testing Library.
- **Playwright** for everything Vitest can't handle in jsdom: auth flows, anything depending on cookies/middleware/the router, and async Server Components, which current test runners cannot render directly — this is a documented capability gap, not a config issue to work around.
- Query by role and accessible name (`getByRole('button', { name: 'Submit' })`), not by test ID or CSS class. This verifies actual user-facing behavior and doubles as a free accessibility check — if you can't query an element by role, a screen reader user can't reliably find it either.
- Mock at the network boundary (MSW — Mock Service Worker) rather than mocking data-fetching functions directly, so tests stay honest about what's actually sent and received.
- Prioritize coverage on paths that cost the business money if broken (auth, checkout, primary CTA) over chasing a high percentage coverage number.

```ts
// vitest.config.ts — minimal current setup
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

## Recommended default stack (when the user has no existing constraints)

- **Framework**: Next.js, App Router
- **Language**: TypeScript, strict mode on
- **Styling**: Tailwind CSS, paired with shadcn/ui for accessible component primitives rather than hand-rolling dropdowns/dialogs/comboboxes
- **Server state**: TanStack Query
- **Client state**: Zustand
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + React Testing Library + Playwright

This is a starting point, not a mandate — adjust when the project's existing stack, team size, or constraints point elsewhere.

## Anti-patterns to flag in review

- `'use client'` at the top of a page/layout file when only one small piece is interactive.
- Manual `useEffect` + `setState` to sync server data — replace with TanStack Query.
- A global Redux/Zustand store holding everything, including state only one component ever reads.
- `useMemo`/`useCallback` sprinkled defensively everywhere "just in case" on a project that already has the Compiler enabled — dead weight the compiler already subsumes.
- `<div>` soup with no semantic elements, no ARIA where ARIA is actually needed, no keyboard handling on custom interactive widgets.
- Images without `next/image` and without explicit dimensions, causing layout shift.
- Snapshot tests of large serialized component trees — these break on any styling change and rarely catch real regressions; prefer targeted behavioral assertions.
- Running an affected version of React/Next.js (see security section above) without having checked patch status.
