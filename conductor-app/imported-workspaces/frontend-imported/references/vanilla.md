# Vanilla HTML / CSS / JS — stack reference

Read this after Step 0 of `SKILL.md` has determined no framework is wanted. This file is shaped differently from the other stack references: there's no single ecosystem to chart a course through, so this covers what the modern web platform can do natively, how to structure a framework-free project so it doesn't collapse into chaos, and — just as importantly — when "no framework" stops being the right call and should be said out loud rather than pushed through anyway.

## When vanilla is genuinely the right choice (and when to say so)

Framework-free is a strong fit for: marketing sites, server-rendered pages with light interactivity, embedded widgets, internal tools where simplicity beats architectural sophistication, and any project where every kilobyte of shipped JS matters. A typical React app with routing, state management, and UI libraries can easily ship 150–300KB of framework overhead before any application code — for a mostly-static page, that's pure cost with no corresponding benefit.

**Say so explicitly when the requirements have outgrown this choice.** If a request mid-conversation starts describing something with deep nested state, many interacting views, or real-time collaborative editing, that's the moment to flag — out loud, not just by quietly reaching for a framework anyway — that a framework would now genuinely reduce complexity rather than add it. The judgment call isn't "vanilla is always better" or "vanilla is always a toy choice" — it's matching the tool to what's actually being built, and naming the trade-off when it shifts.

## What the platform now covers natively (no library needed for these)

The web platform in 2026 covers far more than vanilla JS did a decade ago — many problems that used to require a library now have a built-in solution:

- **Modules & code organization**: native ES modules (`import`/`export`), dynamic `import()` for code-splitting, import maps for dependency resolution — no bundler required for small-to-medium projects.
- **Components**: **Web Components** — Custom Elements (`class extends HTMLElement`), Shadow DOM for style/markup encapsulation, and `<template>`/`<slot>` for reusable structure. Custom Elements v2 and **Declarative Shadow DOM** now have full native support across Chrome, Firefox, Safari, and Edge — Declarative Shadow DOM specifically means Shadow DOM markup can be served directly from the server with zero client JS needed for first render, which removes one of the old arguments against Web Components for SSR-style use cases.
- **Data fetching**: the Fetch API, with `async`/`await` — no need for a fetch-wrapper library for standard request/response work.
- **Reactivity without a framework**: the `Proxy` API can intercept property get/set to build lightweight reactive state (re-render on mutation) without pulling in a signals or virtual-DOM library. This is a real, workable pattern for small-to-medium state needs, not just a toy technique.
- **Scroll/visibility-based behavior**: `IntersectionObserver` for lazy-loading and scroll-triggered effects, without a scroll-event-listener-and-math approach.
- **Routing**: the History API (`pushState`/`popState`) plus a small router module is entirely sufficient for SPA-style navigation in a framework-free app — this doesn't require a routing library.
- **Styling**: modern CSS (container queries, `:has()`, nesting, custom properties, `@layer`) covers most responsive/complex layout needs that used to require JS-driven solutions or a CSS framework.

## Project structure

Even without a framework, structure matters — "no framework" doesn't mean "no architecture":

```
my-app/
  index.html
  js/
    main.js              # entry point
    router.js            # History API wrapper
    store.js             # reactive state (Proxy-based or simple pub/sub)
    components/
      todo-item.js        # one Web Component per file
      modal.js
  styles/
    main.css
```

Organize JS into modules from the start, even for a small project — a flat `script.js` with everything in it is the most common way a "simple, no-framework" project becomes unmaintainable. Use `connectedCallback`/`disconnectedCallback` lifecycle hooks on custom elements the same way a framework component would use mount/unmount hooks — don't skip lifecycle management just because there's no framework enforcing it.

## A minimal Web Component, for reference

```js
class TodoItem extends HTMLElement {
  static observedAttributes = ['label', 'done'];

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.render();
  }

  render() {
    const label = this.getAttribute('label') ?? '';
    const done = this.hasAttribute('done');
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: flex; align-items: center; gap: 0.5rem; }
        .done { text-decoration: line-through; opacity: 0.6; }
      </style>
      <input type="checkbox" ${done ? 'checked' : ''} />
      <span class="${done ? 'done' : ''}">${label}</span>
    `;
  }
}
customElements.define('todo-item', TodoItem);
```

Shadow DOM here prevents the component's internal styles from leaking into (or being affected by) the rest of the page — this is the main structural benefit a framework's scoped-CSS solution is also trying to give you, but native.

## When hand-rolled vanilla starts costing more than it saves

Be honest about the real trade-off: writing Web Components by hand is genuinely more verbose than the equivalent framework component — passing data down, handling custom events back up, and diffing/re-rendering on state change all require manual work that a framework would give for free. If a project's state management or prop-passing is clearly becoming the bulk of the code being written, that's a real signal, not a failure — at that point, two honest paths exist:

1. **A small framework-adjacent library** rather than a full framework — Lit (Web Components with reactive templates and scoped styles, ~5KB), Alpine.js (declarative reactivity directly in HTML attributes, ~15KB), or Preact (a React-compatible API at a fraction of React's size, ~3KB) — these meaningfully reduce the verbosity cost while keeping the bundle-size benefit largely intact.
2. **Actually switching stacks** — if the project has grown into something with deep interdependent state and many interacting views, say so directly and revisit Step 0 of `SKILL.md` rather than continuing to force the vanilla approach.

Don't silently keep hand-rolling increasingly elaborate state-management code in vanilla JS as a point of principle once it's clearly the wrong tool for the current scope — that serves neither performance nor maintainability at that point.

## Accessibility specifics for vanilla/Web Components

- There's no framework-level a11y linting safety net here (no `eslint-plugin-jsx-a11y` equivalent watching every render) — semantic HTML and explicit ARIA attention matter even more without that automated backstop.
- Custom Elements don't get native form participation or accessibility semantics for free — a custom element meant to act like an input needs the **Element Internals API** (`attachInternals()`) to properly participate in forms and expose correct accessibility roles/states; without it, assistive technology may not recognize the custom element as an interactive control at all.
- Shadow DOM encapsulation can interfere with some ARIA relationships that rely on ID references crossing the shadow boundary (e.g. `aria-describedby` pointing to an element in a different shadow root) — be deliberate about which content actually needs to be encapsulated versus rendered in the light DOM.
- Focus management for custom modals/dialogs is entirely manual here — there's no Radix/Headless-UI-equivalent doing it underneath. Use the native `<dialog>` element where possible; it handles focus trapping and ESC-to-close natively and is broadly supported, which is a meaningfully better starting point than a hand-rolled `<div>`-based modal.

## Testing

- **Vitest** or plain **Playwright** both work without any framework-specific adapter — vanilla JS/Web Components don't need a special test renderer the way a framework component does, since there's no virtual component tree to mount.
- Test Web Components by mounting them into a real DOM (jsdom is sufficient for most logic; use Playwright/real-browser testing specifically when Shadow DOM rendering or CSS behavior needs verification, since jsdom's Shadow DOM support is incomplete).
- For Proxy-based reactive state, test the state object's behavior directly and independently of the DOM — these are just JS objects with intercepted get/set, and testing them as plain logic (not through rendered output) is both simpler and more robust to markup changes.

## Anti-patterns to flag in review

- One giant `script.js` file with no module boundaries, as a project grows past "small."
- Custom elements with no lifecycle management — appending event listeners in `connectedCallback` but never removing them in `disconnectedCallback`, leaking listeners on every re-mount.
- A hand-rolled modal/dialog with no focus trap, when the native `<dialog>` element would have handled it for free.
- Form-like custom elements with no Element Internals API usage, invisible to assistive technology and to native form submission/validation.
- Continuing to hand-roll increasingly complex state-passing logic well past the point where a small library (Lit/Alpine/Preact) or a full framework switch would clearly reduce total complexity — and not naming that trade-off to the person making the request.
