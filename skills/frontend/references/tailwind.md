# Tailwind CSS - styling reference

Read this when a frontend task uses Tailwind CSS or when the user wants utility-first styling.

## Default posture

- Use Tailwind as a design-token delivery mechanism, not as an excuse to avoid design decisions.
- Keep spacing, color, radius, and typography choices intentional.
- Prefer reusable patterns for repeated UI instead of endlessly copying long class strings.

## Good usage rules

- Extract repeated combinations into components before extracting them into custom utility abstractions.
- Use CSS variables for theme values that should stay coherent across the product.
- Use `clsx` or similar conditional composition helpers when variants become non-trivial.
- Keep responsive behavior explicit at the call site when it helps readability.

## When to extract

Extract a component when:

- the same visual pattern appears 3+ times
- the behavior matters as much as the style
- a variant system is emerging

Extract custom CSS only when:

- the pattern is cross-cutting and too verbose in utility form
- you need keyframes, advanced selectors, or rich editor styling
- the design system already expects semantic utility wrappers

## Avoid these habits

- huge unreadable `className` strings with no grouping logic
- mixing arbitrary values everywhere instead of converging on tokens
- adding custom CSS for things Tailwind already expresses clearly
- using Tailwind to ship visually generic UI with no design intent

## Review anti-patterns

- inconsistent spacing scales within one screen
- text colors that miss contrast requirements
- hover states without focus-visible equivalents
- responsive classes added as patchwork instead of planned layout changes
