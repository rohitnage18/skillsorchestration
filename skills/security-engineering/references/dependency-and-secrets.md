# Dependency and secrets review

Use this file when the request touches CI/CD, environment files, package hygiene, or credential handling.

## Dependency review

- identify critical frameworks and auth libraries
- check for obvious stale or high-risk surfaces
- note when a framework family has a known history of severe recent vulnerabilities
- flag unmaintained or unnecessary packages in privileged paths

## Secret handling review

- secrets must not live in committed source files
- examples should stay sanitized
- CI/CD secrets should be environment-scoped
- preview jobs should not inherit production secrets without need

## Workflow checks

- can direct pushes bypass review
- can arbitrary branches deploy production
- are tokens over-scoped
- are audit and approval paths protected

## Remediation style

Prefer concrete advice:

- rotate the exposed secret
- move the value to environment secrets
- scope the token to staging only
- require PR-only merges for production branches
