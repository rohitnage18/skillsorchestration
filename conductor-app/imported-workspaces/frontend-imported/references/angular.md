# Angular — stack reference

Read this after Step 0 of `SKILL.md` has determined Angular is the chosen stack. This is the complete playbook for Angular work: signals and reactivity, architecture, state management, testing (including a major recent default change), performance, and accessibility specifics. The aesthetic and engineering-bar principles in `SKILL.md` still apply — this file adds the Angular-specific *how*.

## Current baseline

- **Standalone components are the default** — not NgModules. Standalone components, directives, and pipes declare their own dependencies directly, giving cleaner imports and better dependency visibility. Only reach for NgModules when maintaining a legacy codebase already built that way.
- **Signals are the default reactivity primitive** for component and shared state, introduced in v16 and consolidated through v17–19. RxJS hasn't been replaced — the two are complementary, not competing (see below).
- **TypeScript** is foundational to Angular, not optional — there's no "plain JS Angular" path worth defaulting to.

## Signals vs. RxJS — use both, deliberately

This is the most important architectural distinction in modern Angular, and getting it backwards (using RxJS for everything, or trying to force Signals into asynchronous stream scenarios) is the most common mistake.

| Use **Signals** for | Use **RxJS Observables** for |
|---|---|
| Synchronous, local component/UI state | Asynchronous data streams — HTTP calls, WebSocket messages |
| Derived/computed values (`computed()`) | Complex operator-based manipulation (combining, debouncing, retrying multiple streams) |
| Values read directly in templates | Long-lived subscriptions with complex lifecycle needs |

**The standard interop pattern**: fetch with RxJS, convert to a Signal at the boundary where data enters the UI layer (e.g. via `toSignal()`, or the newer `resource()`/`httpResource()` APIs for request-driven state). Don't manually subscribe to an Observable inside a component when the `async` pipe — or converting to a signal — already solves it declaratively.

```ts
// Signal-based local/derived state
import { signal, computed } from '@angular/core';

const count = signal(0);
const doubleCount = computed(() => count() * 2);
count.set(5);     // direct set
count.update(v => v + 1); // derived update
```

```ts
// readonly signal exposed from a service, mutated only internally
@Injectable({ providedIn: 'root' })
export class CounterState {
  private readonly _count = signal(0);
  readonly count = this._count.asReadonly();
  increment() { this._count.update(v => v + 1); }
}
```

**Signal Forms** (previewed in recent Angular versions) bring the same reactive model to forms: field state (`disabled()`, `invalid()`, `dirty()`, `errors()`) is exposed as signals directly off the form object, replacing some of what `FormGroup`/`FormControl` + RxJS used to require by hand. Check the installed Angular version before assuming this API is stable — it shipped as a preview feature and matured over several releases.

## State management — tiered, not one-size-fits-all

Match the tool to the actual scope and complexity of the state, escalating only when needed:

1. **Local component state** — plain `signal()`/`computed()` inside the component. The majority of state belongs here.
2. **Shared feature state** — a `@Injectable` service holding signals, provided at the appropriate DI scope (root for app-wide singletons like auth/session; route or component scope for state that should be torn down with its consumers). This "Service Store" pattern is the default choice for most medium-to-large applications — don't reach for a heavier library before this stops being sufficient.
3. **Complex/large-scale shared state** — **NgRx Signal Store** (`@ngrx/signals`) when a service-based store's growing complexity genuinely warrants more structure: enforced patterns across a large team, complex derived state graphs, or the need for devtools-grade traceability. This has substantially less boilerplate than classic NgRx and is signal-native throughout.
4. **NGXS** is a viable, lower-boilerplate alternative to NgRx for teams that want structure without the strict Redux-style pattern — worth mentioning as an option, not a default.

**DI scope is the single hardest decision to change later.** Before writing a shared store, explicitly decide who owns this state and what its lifecycle should be — moving state from root scope to route scope later means rewiring every consumer; moving the other direction means re-deriving ownership assumptions. Get this right at the point of creation rather than defaulting to root scope out of convenience.

**Encapsulation pattern worth following**: keep the writable signal private inside the store/service; expose only a readonly signal (`.asReadonly()`) and named methods for mutation. Components read state and call methods — they never call `.set()`/`.update()` directly on store internals. This keeps mutations traceable and the store testable in isolation.

## Testing — Vitest is now the default, not Karma/Jasmine

**This is a recent and significant change worth getting right**: as of Angular 21, **the Angular CLI uses Vitest as the default unit test runner for new projects**, replacing the Karma/Jasmine stack that was standard for the prior decade. If working in an existing pre-21 project, it may still be on Karma/Jasmine — check `angular.json`'s test builder before assuming either default.

- The familiar `describe`/`it`/`expect` API and the `TestBed` API are unchanged — this is primarily an infrastructural migration, not a rewrite of test-writing patterns.
- Angular's official `refactor-jasmine-vitest` schematic can automatically convert most existing Jasmine test files (e.g. `jasmine.createSpy` → `vi.fn`) — it's marked experimental, and complex/nested spy scenarios still need manual review.
- Even under Vitest, Angular still imports `zone.js/testing`, since change detection relies on Zones — this means `fakeAsync`, `tick`, and `flush` continue working exactly as they did under Karma.
- Vitest can run in a lightweight DOM emulation (happy-dom/jsdom, the default, for speed) or in a real browser via a configured provider (e.g. Playwright) when a test genuinely needs real browser behavior.
- Vitest does not pollute globals by default the way Jasmine's CLI setup did — `describe`/`it`/`expect`/`vi` are typically imported explicitly unless global mode is opted into.

For end-to-end coverage of full user flows (auth, checkout, critical multi-step forms), **Playwright** is the standard choice, same as the other stacks in this skill.

## Performance

- **`OnPush` change detection** should be the default change-detection strategy for components, not the exception — it tells Angular to only check a component when an `@Input` reference changes or an event originates from within the component/its children, avoiding unnecessary full-tree checks.
- Reading a signal inside an `OnPush` component's template automatically registers it as a dependency — when that signal changes, Angular marks the component for update on the next change-detection pass. This fine-grained tracking is a major part of why Signals improve on the older default change-detection behavior.
- Lazy-load routes and features (standalone components make this straightforward without NgModule ceremony) so the initial bundle only contains what's needed for first paint.
- Avoid manual subscriptions left active without cleanup — prefer the `async` pipe (auto-unsubscribes) or `takeUntilDestroyed()` for RxJS subscriptions that must be manual, rather than hand-rolling `ngOnDestroy` unsubscribe logic everywhere.

## Accessibility specifics for Angular

- Angular Material and CDK components ship with ARIA and keyboard-interaction patterns already solved for common widgets (dialogs, menus, comboboxes) — if these are already in the project, build on them rather than hand-rolling equivalent custom components.
- Manage focus explicitly on route changes — Angular Router doesn't do this automatically; a route change that meaningfully changes page content should move focus to the new content's heading or main landmark for screen reader and keyboard users.
- The same conditional-rendering focus-trap gap exists here as in any framework: a modal/dialog opening via `*ngIf`/`@if` needs to actively trap and later restore focus, which Angular Material's `MatDialog` already handles — don't bypass it with a hand-rolled modal unless there's a specific reason to.

## Anti-patterns to flag in review

- Manually subscribing to an Observable inside a component instead of using the `async` pipe or converting to a signal at the UI boundary.
- Reaching for full NgRx (or even NgRx Signal Store) before a simple service-based signal store has actually been outgrown.
- Components calling `.set()`/`.update()` directly on a store's internal signal instead of going through exposed methods.
- Choosing root-scope DI for state that's actually route- or component-scoped (or vice versa) without deliberately deciding ownership first.
- Assuming a project is on Karma/Jasmine (or on Vitest) without checking `angular.json` — the default changed at Angular 21, and projects predating that may not have migrated.
- Skipping `OnPush` by default on components with no specific reason not to use it.
- Hand-rolled modal/dialog focus management when Angular Material's `MatDialog` already solves it correctly.
