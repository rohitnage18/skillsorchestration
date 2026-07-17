# Environments and secrets

Use this file when the task touches staging, preview, production, or delivery credentials.

## Environment model

Keep environments explicit:

- development
- preview or ephemeral review
- staging
- production

Do not let one ambiguous "server" stand in for all of them.

## Secrets rules

- keep secrets in the deployment platform or CI provider
- rotate credentials that have been exposed or committed
- scope secrets by environment when possible
- separate read-only, write, and production-level credentials

## Deployment safety

- require explicit approval or protected-branch gating for production
- run migrations carefully and only in the right environment
- keep rollback or recovery thinking close to the deployment plan

## Review anti-patterns

- production secrets reused in preview jobs
- one environment file copied everywhere
- workflows that can deploy production from an arbitrary branch
- no documented ownership for deploy credentials
