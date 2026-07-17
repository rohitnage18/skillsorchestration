# Svelte / SvelteKit — stack reference

Read this after Step 0 of `SKILL.md` has determined Svelte is the chosen stack. This is the complete playbook for Svelte work: reactivity model, routing/data conventions, state management, performance, accessibility specifics, and testing. The aesthetic and engineering-bar principles in `SKILL.md` still apply — this file adds the Svelte-specific *how*.

## Critical baseline: runes, not legacy reactivity

**Svelte 5 replaced its entire reactivity model.** This is the single most important fact in this file, because outdated training data and tutorials default to the old syntax, and writing it in a Svelte 5 project either silently breaks or requires a legacy compatibility mode the project may not have enabled.

| Legacy (Svelte 3/4) — do not write this | Current (Svelte 5 runes) — write this instead |
|---|---|
| `let count = 0` (implicit reactivity) | `let count = $state(0)` |
| `$: doubled = count * 2` | `let doubled = $derived(count * 2)` |
| `onMount(() => {...})` for reactive side effects | `$effect(() => {...})` |
| `export let propName` | `let { propName } = $props()` |
| `<slot />` | Snippets: `{@render children()}` |
| `on:click={handler}` | `onclick={handler}` (event handlers are now plain props) |
| `import { writable } from 'svelte/store'` for new code | A `.svelte.ts` module exporting `$state` directly, or a class using `$state` for its fields |

**If reviewing or continuing an existing project**: check whether it's actually on Svelte 5 runes mode before writing anything. A project can still have `compilerOptions.runes: false` for legacy compatibility — in that case, match the existing pattern rather than introducing a second reactivity system in the same codebase. Mixing runes and legacy `$:`/`export let` syntax inconsistently is a real and common mistake to avoid introducing.

**`$state` reactivity note**: objects and arrays passed to `$state(...)` are made deeply reactive via proxying, which has a performance cost. For large data that's only ever reassigned wholesale rather than mutated in place — API responses being the canonical example — use `$state.raw(...)` instead to skip the proxy overhead.

## State management

Svelte's own primitives cover most of what other ecosystems need a library for:

| State type | Tool | Notes |
|---|---|---|
| Component-local state | `$state` | The majority of state. |
| Derived/computed values | `$derived` | Keep the expression free of side effects — it should be pure. |
| Reusable reactive logic shared across components | A `.svelte.ts` module exporting `$state`-backed values, or a class with `$state` fields | This has replaced the old `writable()` store pattern as the default for new code. The `.svelte.ts` extension is required — plain `.ts` files cannot use runes. |
| App-wide/global state | Same `.svelte.ts` module pattern, imported wherever needed | No separate state-management library is generally needed at this scale. |
| Per-request state in SvelteKit (auth session, request-scoped data) | `event.locals`, set in `hooks.server.ts` | Never use a module-level singleton for per-request data — it leaks across concurrent requests on the server. Svelte contexts (set in the root layout) are the client-side equivalent for safely-scoped shared state. |
| Reactive route/navigation info | `$app/state` (e.g. `import { page } from '$app/state'`) | This is the runes-based replacement for the old `$app/stores`, which is deprecated as of SvelteKit 2.12. No `$` prefix needed — `page.url.pathname`, not `$page.url.pathname`. |

**Don't reach for Redux/Zustand-equivalent libraries by default.** SvelteKit's `+page.server.ts` load functions plus runes-backed shared state cover what those libraries solve in other ecosystems — the framework's own data-loading model is often the actual data layer, not a bolted-on client store.

**Legacy store interop**: if a third-party library still exports a legacy `writable`/`readable` store, that's fine to use as-is — wrap it with the `$store` auto-subscription syntax in templates and `get(store)` in script, but don't read `.value` off it as if it were a rune, and don't mix legacy stores and runes for the same piece of state within one module.

## SvelteKit file conventions

| File | Runs | Purpose |
|---|---|---|
| `+page.svelte` | Client (+ SSR) | The page UI |
| `+page.ts` | Server AND client | Universal `load` — data fetching that's safe to also run in the browser |
| `+page.server.ts` | Server only | DB calls, secrets, form actions — anything that must never reach the client bundle |
| `+layout.svelte` | Client (+ SSR) | Wraps child routes; render children via `{@render children()}` from `$props()` |
| `+server.ts` | Server only | API endpoints — named exports for `GET`, `POST`, etc. |
| `+error.svelte` | Client (+ SSR) | Renders for thrown errors |
| `hooks.server.ts` | Server only | Middleware: `handle`, `handleFetch`, `handleError` |

**Never put secrets or a database client in `+page.ts`** — being a *universal* load function, anything referenced there is reachable from client code and will leak into the client bundle. Secrets and DB access belong exclusively in `+page.server.ts`.

Form actions live in `+page.server.ts` and are invoked via `<form method="POST" action="?/actionName">`; pair with `use:enhance` for progressive enhancement so the form still works without JS and gets a smoother client-side experience when JS is available.

## Rendering and performance

- Svelte compiles away the framework rather than shipping a runtime — there's no virtual DOM diffing overhead, and the resulting bundles are meaningfully smaller than the equivalent React/Vue output, especially for content-heavy pages with limited interactivity.
- **Hydrate only what needs it.** A content-heavy page (marketing, blog) can ship near-zero JS for static text and only hydrate the genuinely interactive piece (a signup form, a like button) — this granular control is one of Svelte's main structural advantages, so don't undermine it by wrapping more of the page in client-side logic than necessary.
- SvelteKit supports SSR, SSG, and hybrid rendering per-route — choose deliberately per page rather than defaulting one strategy for the whole app: a marketing page can be statically generated while an authenticated dashboard uses server rendering for fresh data.
- Fetch data server-side in `+page.server.ts` for anything involving third-party APIs or secrets — this keeps API keys off the client and avoids request waterfalls in the browser.

## Accessibility specifics for Svelte

- Svelte's compiler emits accessibility warnings at build time (missing `alt`, invalid ARIA, missing keyboard handlers on interactive elements) — don't suppress these; treat a build with new a11y warnings the same as a build with new type errors.
- For custom interactive components (modals, dropdowns, comboboxes), use Svelte actions (`use:action`) to encapsulate focus-trap and ARIA-attribute logic in one reusable place, rather than re-implementing keyboard handling inline in every component that needs it.
- Conditional rendering (`{#if}` blocks toggling a modal) has the same focus-management gap as any framework — opening a modal needs to move focus into it, and closing it needs to restore focus to the trigger. This isn't automatic.

## Testing

The Svelte testing landscape is mid-transition — be aware of both approaches rather than assuming only one exists:

- **`@testing-library/svelte` + jsdom** is still the default starting point for most new projects and supports Svelte 3, 4, and 5. This is the safe, well-documented choice.
- **`vitest-browser-svelte`** (Vitest's real-browser mode, via Playwright) is gaining adoption specifically because **runes only work in a genuine browser/component context, not plain Node.js** — testing reactive `$state`/`$derived` logic in jsdom can be unreliable or require workarounds, while browser mode tests the real reactivity system directly. If a project is hitting friction testing rune-based reactive logic under jsdom, migrating that suite to browser mode is a legitimate and increasingly common fix, not a sign something else is wrong.
- For testing logic extracted into a `.svelte.ts` module (the pattern recommended above for shared reactive state), name the test file with the `.svelte.test.ts` suffix — this is required for the test file itself to be allowed to use runes.
- External/shared state manipulated outside a component context generally needs an explicit `flushSync()` call after mutation to force a synchronous DOM update in tests; state that lives inside the component itself updates automatically.
- **Playwright** remains the standard for full end-to-end coverage of critical flows (auth, checkout, multi-step forms).
- Server-only logic (`+page.server.ts` load functions, form actions) can and should be tested as plain functions, in isolation from any UI — they're just functions, so don't route this through component rendering machinery at all.

```ts
// example: testing reactive logic extracted into a .svelte.ts module
// multiplier.svelte.ts
export function multiplier(initial: number, k: number) {
  let count = $state(initial);
  return {
    get value() { return count * k; },
    set: (c: number) => { count = c; },
  };
}
```
```ts
// multiplier.svelte.test.ts — note the .svelte.test.ts suffix, required to use runes here
import { expect, test } from 'vitest';
import { multiplier } from './multiplier.svelte.js';

test('multiplier', () => {
  const double = multiplier(0, 2);
  expect(double.value).toEqual(0);
  double.set(5);
  expect(double.value).toEqual(10);
});
```

## Anti-patterns to flag in review

- Writing `let x = 0` for state, `$:` for derived values, `export let` for props, or `<slot />` in a project running Svelte 5 runes mode — these are the most common mistakes made by anyone (or any AI assistant) still pattern-matching to Svelte 3/4 habits.
- A module-level singleton holding per-request state in a SvelteKit server context — this leaks data across concurrent requests.
- Secrets or DB clients referenced in `+page.ts` instead of `+page.server.ts`.
- Mixing legacy `writable` stores and runes for the same logical piece of state within one module.
- `$state(...)` wrapping a large API response that's only ever replaced wholesale, where `$state.raw(...)` would avoid unnecessary proxy overhead.
- Hand-rolled focus-trap logic duplicated across multiple components instead of one shared `use:action`.
- Reaching for a heavyweight external state-management library before checking whether SvelteKit's load functions plus a `.svelte.ts` module already solve the problem.
