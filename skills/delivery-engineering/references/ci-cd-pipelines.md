# CI/CD pipelines

Use this file when designing or reviewing a delivery pipeline.

## Default pipeline shape

For most repos:

1. checkout
2. install dependencies deterministically
3. run fast static checks
4. run tests
5. build artifacts
6. optionally package or publish artifacts
7. deploy only from approved branches or environments

## Branch policy defaults

- run CI on all working branches
- run required validation on pull requests into `main`
- block direct pushes to protected branches where the platform allows it
- use branch protection, not social convention alone

## Monorepo guidance

If multiple projects live in one repo:

- isolate jobs by working directory
- cache per lockfile where possible
- avoid rebuilding unrelated projects when the platform or workflow design can narrow scope

## Good pipeline qualities

- deterministic installs
- explicit Node/runtime versions
- short feedback loops on branch pushes
- separate validation from deployment
- concurrency rules to cancel stale branch runs

## Review anti-patterns

- one huge workflow with no job boundaries
- direct deploy from every push without branch safety
- production deploys mixed into normal test jobs
- secrets exposed as plain env values in committed files
- no distinction between PR validation and release automation
