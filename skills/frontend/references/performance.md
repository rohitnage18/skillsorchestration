# Performance

Use this file when the frontend task involves speed, responsiveness, or rendering strategy.

## Review areas

- rendering strategy by route
- JavaScript shipped to the client
- image and media cost
- bundle splitting
- input responsiveness
- layout stability

## Good defaults

- default to server-first rendering where the stack supports it
- hydrate only what truly needs interactivity
- lazy-load below-the-fold or rarely used UI
- preserve stable layout boxes for async content

## Practical rule

If the page feels fast only on a powerful laptop and ideal network, performance work is not finished.
