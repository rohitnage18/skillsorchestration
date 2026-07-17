# Testing

Use this file when deciding how to validate frontend behavior.

## Coverage layers

- component tests for logic-heavy UI
- integration tests for data + UI interactions
- end-to-end tests for critical journeys

## Test quality checks

- test what the user can see or do
- cover loading, empty, error, and permission states
- avoid coupling tests to fragile implementation details
- keep accessibility-critical interactions in scope

## Practical rule

If a regression in the primary user journey would only be caught by manual clicking, the test strategy is too thin.
