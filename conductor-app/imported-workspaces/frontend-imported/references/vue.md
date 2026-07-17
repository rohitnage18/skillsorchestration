# Vue / Nuxt — stack reference

Read this after Step 0 of `SKILL.md` has determined Vue is the chosen stack. This is the complete playbook for Vue work: architecture, state management, performance, accessibility specifics, and testing. The aesthetic and engineering-bar principles in `SKILL.md` still apply — this file adds the Vue-specific *how*.

## Current baseline

- **Composition API with `<script setup>`** is the default, not the Options API. Options API is acceptable only when matching an existing legacy codebase that already uses it consistently.
- **TypeScript** by default for any non-trivial project.
- **Pinia** is the official state management library, replacing Vuex. Use the **setup store syntax** (`ref`/`computed`/functions inside `defineStore`) over the options store syntax — it mirrors the Composition API directly and gives better TypeScript inference.
- **Nuxt vs. plain Vue + Vite** — this is a real architectural decision, not a default to reach for automatically:
  - **Nuxt**: choose this when the app needs SEO (marketing pages, blogs, e-commerce), needs server-side rendering for performance or data freshness, or benefits from co-located API routes and file-based routing.
  - **Plain Vue + Vite**: choose this for an authenticated SPA — dashboards, internal tools, anything behind a login where SEO is irrelevant — or whenever the simplest possible setup is preferable. Nuxt adds real power but also real complexity; don't reach for it reflexively.
- **Vite** is the build tool either way (Nuxt is built on it).

## Project structure

Past roughly 50 components, a flat `src/components/` directory becomes unmanageable. Organize by domain/feature, not by technical type:

```
src/
  modules/                # or features/
    user-billing/
      components/
      composables/
      stores/
    project-board/
      components/
      composables/
      stores/
  shared/
    ui/                   # atomic, business-logic-free components (buttons, inputs, modals)
  core/
    api/                  # API client setup
    auth/
```

For Nuxt specifically: Pinia store files go in `stores/` (or `app/stores/` in Nuxt 4) to take advantage of auto-import; name each file after its responsibility (`user.ts`, `cart.ts`), not generically.

## State management

Vue splits state responsibility more explicitly than some other ecosystems — match the tool to the job rather than putting everything in one store:

| State type | Tool | Notes |
|---|---|---|
| Local/scoped state | **`ref` / `reactive`** inside the component | The majority of state. Don't promote to a store prematurely. |
| Reusable logic across components | **Composables** (`useX()` functions) | For shared logic that doesn't need to be globally accessible — form handling, a shared piece of UI behavior, a wrapped browser API. |
| Global client state | **Pinia** (setup store syntax) | UI state, user preferences, locally-created data that's genuinely needed across unrelated components. |
| Server/API state | **Pinia Colada** | Reached stable release in early 2026; purpose-built to complement Pinia for data fetched from APIs — caching, deduplication, background revalidation, optimistic updates. This is Vue's equivalent of TanStack Query, and is now the recommended approach rather than hand-rolling fetch logic in a Pinia store. |

**Anti-pattern to flag**: manually fetching data in a Pinia store action and tracking loading/error state by hand. That's exactly what Pinia Colada exists to replace.

**Reactivity gotcha when reading from Pinia**: accessing a store property directly in a template (`store.count`) is safe and stays reactive. Destructuring properties off a store in script (`const { count } = store`) breaks reactivity — use Pinia's `storeToRefs(store)` helper when destructuring is wanted.

**SSR note**: in Nuxt, `@pinia/nuxt` handles state serialization and hydration automatically — don't hand-roll a workaround for "state doesn't survive the server/client boundary," that's already solved.

## Performance

- Favor `<script setup>` — it compiles to more efficient code than the Options API and avoids `this`-binding overhead entirely.
- Lazy-load routes (`defineAsyncComponent`, or Nuxt's automatic route-based code splitting) so the initial bundle only contains what the first paint needs.
- Watch for unnecessary deep reactivity: `reactive()` on a large, deeply-nested object that's mostly read-only is more expensive than it needs to be — consider `shallowRef`/`shallowReactive` for large data structures that don't need nested reactivity, or keep large static data outside the reactivity system entirely.
- Use `v-once` or `v-memo` for list content that's expensive to re-render and rarely changes, rather than letting it re-diff on every parent update.
- In Nuxt, lean on built-in image (`<NuxtImg>`) and font handling for the same layout-shift and format-negotiation benefits React's `next/image`/`next/font` provide — don't hand-roll this.

## Accessibility specifics for Vue

- Conditional rendering with `v-if`/`v-show` has the same focus-management gap as any framework: removing/showing a modal doesn't automatically move or restore keyboard focus. Handle this explicitly, or use a library (e.g. Radix Vue, Headless UI for Vue) that's already solved it for dialogs, menus, and comboboxes.
- Component libraries like Vuetify or PrimeVue already handle a great deal of baseline accessibility (keyboard nav, ARIA) for their components — if one of these is already in the project, don't duplicate that work by hand-rolling equivalent primitives; put review effort into the custom components instead.
- `v-html` is an XSS and accessibility risk simultaneously — content inserted this way bypasses Vue's templating safety and can break screen-reader semantics if not properly structured. Sanitize and review any `v-html` use carefully.

## Testing

The current consensus is an integration-heavy pyramid rather than the traditional unit-heavy one:

- **Vitest Browser Mode** (with `vitest-browser-vue`) for the bulk of testing — runs tests in a real browser (via Playwright as the provider) rather than jsdom, which is both more accurate and, in practice, often faster despite higher one-time setup cost. A reasonable split: ~70% integration tests at this layer, ~20% composable unit tests for pure logic, ~10% accessibility/visual regression.
- **Vue Test Utils** remains the official low-level component-testing library if a thinner setup is preferred over Browser Mode.
- **Playwright** (full E2E, not just component-level) for critical user flows — auth, checkout, anything depending on real navigation, route guards, or lazy-loaded async components.
- Mock at the network boundary with **MSW**, not by mocking your composables or store actions directly — this keeps tests honest about what's actually requested and returned.
- If using a pre-built, already-accessible component library, don't re-test its internals — focus test-writing effort on business logic and the flows unique to the app.
- Query by role and accessible text, not CSS selectors or test IDs, for the same reason as in any framework: it verifies real user-facing behavior and doubles as an accessibility check.

```ts
// vitest.config.ts — Browser Mode with Playwright provider
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [vue()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

## Anti-patterns to flag in review

- Mixing Options API and Composition API inconsistently across a codebase with no migration plan.
- Destructuring reactive properties off a Pinia store without `storeToRefs`, silently breaking reactivity.
- Hand-rolled fetch + loading/error state inside a Pinia store action instead of using Pinia Colada.
- `reactive()` wrapping a large, mostly-static dataset that doesn't need deep reactivity.
- Reaching for Nuxt by default on a project that's really just an authenticated internal SPA with no SSR/SEO need.
- `v-html` used without sanitization.
- No focus management on custom modal/dialog components built from scratch instead of using an accessible primitives library.
