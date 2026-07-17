# Reporting and monitoring

Use this file when delivering a QA audit, release recommendation, or test summary.

## Report structure

Use this order:

1. objective
2. scope
3. environment and assumptions
4. coverage summary
5. findings by severity
6. release recommendation
7. monitoring watchlist
8. remaining gaps

## Finding template

Use a compact format like:

```text
[Severity] Short title
Area: <feature or module>
Steps: <numbered or concise repro>
Expected: <expected behavior>
Actual: <observed behavior>
Impact: <user/business/operational impact>
Evidence: <test, screenshot, log, code path, or note>
```

## Release recommendation labels

- `Go`: no blocker/high issues and residual risk is acceptable
- `Go with caution`: release possible, but specific known risks need monitoring
- `No-go`: blocker or unacceptable high-risk issues remain

## Monitoring watchlist

If the project is being shipped or demoed soon, call out what to watch immediately after release:

- login failures
- error spikes
- slow pages or endpoints
- background job failures
- notification delivery failures
- permission or approval anomalies

If the watchlist becomes a sustained production-operability concern, hand the follow-up to `sre`.
