# Modeling and quality

Use this file when designing warehouse tables or validating transformed data.

## Modeling questions

- what is the grain of each table
- what are the stable business keys
- what dimensions describe the facts
- what fields are derived versus source-truth

## Quality checks

Include targeted checks for:

- uniqueness
- nullability
- referential integrity
- accepted values
- freshness
- reconciliation totals

## Practical rule

If an analyst or downstream service could use the table incorrectly because grain or definitions are unclear, the model is not ready.
