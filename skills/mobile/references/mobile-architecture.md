# Mobile architecture

Use this file when shaping screen structure, navigation, and data flow.

## Architecture concerns

- screen and navigation structure
- feature/module boundaries
- separation of presentation, domain, and data concerns
- handling of cached and offline data
- platform service abstractions

## Good defaults

- keep navigation simple and predictable
- isolate platform-specific code deliberately
- avoid giant god-screens with mixed networking, state, and rendering logic
- treat app resume and interruption handling as core behavior

## When cross-platform is a fit

Cross-platform is usually a good fit when:

- both platforms need similar product behavior
- the team values code sharing
- device-native edge cases are manageable

Native may be better when:

- platform-specific UX is central
- performance constraints are tighter
- deep device integration dominates
