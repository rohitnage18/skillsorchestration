# Accessibility

Use this file when reviewing or building interactive UI.

## Core checks

- keyboard reachability
- visible focus treatment
- semantic HTML before ARIA
- form labeling and error association
- contrast against real rendered backgrounds
- reduced-motion support

## Common misses

- clickable `div` elements instead of buttons or links
- modals without focus management
- icon-only controls without an accessible name
- status changes that are invisible to assistive technology

## Practical rule

If a keyboard-only user cannot complete the main flow confidently, the UI is not ready.
