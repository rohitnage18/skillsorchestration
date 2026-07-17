# Mobile quality and performance

Use this file when reviewing app readiness.

## Quality checks

- cold start behavior
- navigation responsiveness
- memory use under common flows
- offline and retry behavior
- crash-prone lifecycle edges
- permission-denied flows

## Performance guidance

- minimize unnecessary rerenders or widget rebuilds
- defer heavy work off the main UI thread
- keep image and list rendering efficient
- profile on representative devices, not only flagship hardware

## Release bar

If the app only feels good on a fast network and a powerful device, it is not ready.
