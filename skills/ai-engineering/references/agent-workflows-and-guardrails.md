# Agent workflows and guardrails

Use this file when the AI feature plans, calls tools, or takes multi-step actions.

## Workflow questions

- what decisions the model is allowed to make alone
- what actions require confirmation
- what tool calls can cause side effects
- what context is required before an action is taken
- how failures and retries are surfaced

## Guardrail checks

- scope tool permissions narrowly
- separate planning from action when risk is higher
- require validation before destructive or high-trust actions
- preserve auditability for model-triggered actions

## Practical rule

If the agent can take a meaningful external action without a clear approval or verification boundary, the workflow needs stronger guardrails.
