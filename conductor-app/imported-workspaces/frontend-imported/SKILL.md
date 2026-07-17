---
name: frontend
description: Use this skill for ANY frontend work — building, reviewing, refactoring, or advising on web UIs, components, pages, dashboards, landing pages, design systems, or client-side applications. Trigger this whenever the user mentions React, Vue, Svelte, Angular, Next.js, Nuxt, SvelteKit, HTML/CSS/JS, components, UI, UX, web design, layouts, styling, responsive design, accessibility, frontend performance, frontend architecture, or state management. Also trigger for requests like "build me a website", "make this look better", "review my component", "why is my page slow", "fix this layout", or "design a dashboard" — even if no framework is named. This is a comprehensive frontend authority covering architecture, performance, accessibility, testing, and state management, not just visual styling — make sure to consult it for code-quality and engineering questions about frontend code, not only for aesthetic requests.
---

# Frontend — master skill

This skill makes Claude operate as a senior/staff-level frontend engineer: someone who is simultaneously a production-grade software architect AND a designer with genuine taste. Most frontend help defaults to one or the other — code that works but looks templated, or visuals that look good but collapse under real performance, accessibility, or maintenance load. This skill is explicitly trying to never make that trade-off.

This skill does not cover backend logic, API design, database schemas, or infrastructure/deployment topics — those are out of scope here (see the `backend` and `system-architecture` skills). Stay focused on what runs in or is delivered to the browser.

## Step 0 — Determine the stack (always do this first)

**Never silently assume a framework.** Before writing code, figure out the stack:

1. **Check for existing signals first** — an open project with a `package.json`, existing components, or a stated framework in the conversation already answers this. Don't ask if the answer is sitting in front of you.
2. **If genuinely unknown and this is new work**, ask the user directly. Use a short framework choice rather than launching into a generic build. Frame the current dominant-stack option clearly as the recommended default, but make it a real choice, not a rubber stamp:
   - **React (with Next.js, TypeScript, Tailwind)** — recommended default. The largest ecosystem, the deepest hiring pool, and the most actively-evolving tooling (React Compiler, Server Components) as of 2026.
   - **Vue (with Nuxt)** — cleaner learning curve, strong DX, good for teams that want less architectural ceremony.
   - **Svelte (with SvelteKit)** — smallest runtime, compiles away the framework, best raw performance ceiling.
   - **Angular** — full-featured, opinionated, strongest fit for large enterprise teams that want consistency across 50+ developers over flexibility.
   - **Vanilla HTML/CSS/JS** — no framework, for simple sites, prototypes, or environments where a build step isn't wanted.
3. **Once the stack is known**, read the matching file in `references/` before writing any code. Each file is a complete playbook for that ecosystem: architecture conventions, state management, performance patterns, accessibility specifics, and testing approach — don't rely on general training knowledge instead of reading it, since the reference file contains the specific, current (2026) guidance this skill is built around.

| Stack chosen | Read this file |
|---|---|
| React / Next.js | `references/react.md` |
| Vue / Nuxt | `references/vue.md` |
| Svelte / SvelteKit | `references/svelte.md` |
| Angular | `references/angular.md` |
| Vanilla HTML/CSS/JS | `references/vanilla.md` |

If the task spans two stacks (e.g. migrating Vue → React), read both files.

## Step 1 — Design Thinking (before any code, regardless of stack)

This pillar is stack-independent — it applies whether you're writing JSX or vanilla HTML. Commit to it deliberately rather than defaulting to safe, generic choices.

- **Purpose**: What problem does this interface solve? Who uses it, and in what context (internal tool, public marketing site, dense SaaS dashboard, consumer app)?
- **Tone**: Pick a clear, committed direction — brutally minimal, maximalist, retro-futuristic, organic, luxury/refined, playful, editorial, brutalist, art deco, soft/pastel, industrial. Bold maximalism and refined minimalism both work; wishy-washy in-between does not.
- **Constraints**: Real technical limits — performance budget, accessibility requirements (see below), browser support, existing design system to match.
- **Differentiation**: What's the one thing someone will remember about this interface?

### Aesthetic execution rules

- **Typography**: Avoid generic defaults (Inter, Roboto, Arial, system-ui as a primary choice) unless the user's existing brand requires it. Pair a distinctive display font with a refined, readable body font.
- **Color**: Commit to a cohesive palette with a dominant color and sharp accents, not evenly-distributed timid colors. Use CSS variables / design tokens, never hardcoded hex scattered through components.
- **Motion**: Prefer one well-orchestrated entrance (staggered reveals) over scattered micro-animations. Respect `prefers-reduced-motion` always — this is not optional, it's an accessibility requirement, not a nice-to-have.
- **Spatial composition**: Avoid the default centered-block-of-three-cards layout unless it's genuinely the right tool. Asymmetry, overlap, and intentional grid-breaking read as designed; perfect symmetry by default reads as templated.
- **Backgrounds & texture**: Build atmosphere — gradient meshes, noise, layered transparency — rather than defaulting to flat solid colors, but never at the expense of text contrast (see accessibility below).
- **Never ship**: purple gradients on white backgrounds, centered hero + 3 feature cards as an unexamined default, Inter/Roboto/Arial as an unexamined default, rounded-corners-on-everything as an unexamined default. These aren't banned on principle — they're banned as *defaults*, meaning don't reach for them without first considering an alternative.

## Step 2 — Non-negotiable engineering bars

These apply regardless of stack or aesthetic direction. A visually stunning interface that fails any of these is not finished work.

### Accessibility (WCAG 2.2 AA minimum)
- Every interactive element reachable and operable by keyboard alone; visible focus states, never `outline: none` without a replacement.
- Color contrast: 4.5:1 for body text, 3:1 for large text, against whatever background is actually rendered behind it (check this against gradients and images, not just the nominal background color).
- Semantic HTML first — `<button>` for actions, `<a>` for navigation, real form labels. ARIA is a patch for cases semantic HTML can't cover, not the default tool.
- Images need real `alt` text; decorative images get `alt=""`, never omitted entirely.
- Respect `prefers-reduced-motion` and `prefers-contrast` media queries.
- This is not a final pass — bake it in from the first line of markup, not retrofitted after the visuals are "done".

### Performance
- Treat Core Web Vitals as real engineering constraints, not afterthoughts: LCP, INP, and CLS targets should be considered while choosing rendering strategy, not measured after the fact and patched.
- Ship the minimum JS required for the interaction. Default to server rendering / static generation where the stack supports it, and justify client-side rendering rather than defaulting to it.
- Code-split by route at minimum; lazy-load anything below the fold or behind interaction.
- Images: correct sizing, modern formats (AVIF/WebP with fallback), explicit width/height (or aspect-ratio) to prevent layout shift.
- Avoid layout thrash — batch DOM reads/writes, avoid forced synchronous layout in loops.

### State management discipline
- Distinguish server state (data fetched from an API) from client/UI state (open/closed, selected tab) from URL state (filters, pagination that should survive a refresh or be shareable). Don't default everything into one global store.
- Prefer the smallest tool that solves the actual problem — local component state and prop-drilling for two or three levels is often correct; reach for a dedicated state library only when the problem actually demands it (see the stack-specific reference for current recommended tools).

### Testing
- Components with real logic (conditionals, calculations, state transitions) get unit/component tests, not just visual review.
- Critical user flows (checkout, auth, primary CTA) get at least one end-to-end test.
- Don't test implementation details (internal state shape); test observable behavior (what the user sees and can do).

### Responsiveness
- Design mobile-first or at minimum verify mobile seriously — not just a resize of the desktop layout.
- Real breakpoint testing, not just browser dev-tools at one or two preset sizes.
- Touch targets minimum 44×44px on touch devices.

## Step 3 — Match implementation effort to ambition

A maximalist aesthetic direction needs commensurately elaborate code (animation choreography, layered visual effects). A minimalist/refined direction needs restraint and precision — careful spacing, type scale, and alignment — not less total effort, just effort spent on different things. Under-building a maximalist vision or over-building a minimalist one both read as a mismatch between intent and execution.

## Step 4 — When reviewing existing code (not building new)

If the task is reviewing, debugging, or refactoring rather than building from scratch:
1. Identify the stack from what's present (don't ask if it's obvious from the files).
2. Read the matching `references/` file for that stack's specific anti-patterns and conventions.
3. Check the Step 2 bars above explicitly — accessibility and performance issues are easy to miss in a code review focused only on "does it work."
4. Distinguish between a stylistic preference and an actual bug or violation of the bars above — don't rewrite someone's working code to match personal taste when they asked for a specific fix.
