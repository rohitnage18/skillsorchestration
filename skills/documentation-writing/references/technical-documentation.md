# Technical documentation

Use this reference for repository documentation, architecture overviews, API references, setup guides, runbooks, contributor guides, and handover material.

## Match the document to the reader’s job

| Reader need | Best artifact |
|---|---|
| Understand what the system is and why it exists | Overview / explanation |
| Complete a specific task | How-to guide |
| Learn the system step by step | Tutorial |
| Look up exact behavior, fields, commands, or endpoints | Reference |
| Operate, recover, or troubleshoot the system | Runbook |
| Understand a structural decision and trade-offs | ADR / architecture explanation |
| Take ownership from another team | Handover document |

Do not force every reader need into one README. Link focused documents through a short navigation section.

## Repository overview

Document:

- purpose and boundaries;
- architecture and component responsibilities;
- repository layout;
- prerequisites and supported versions;
- minimum setup and verification path;
- configuration categories without exposing secrets;
- common commands;
- troubleshooting and known limitations;
- links to detailed references and runbooks.

The fastest verified path to a working state should be visible before optional configuration.

## Architecture documentation

Include:

- system context and external actors;
- containers/components and ownership boundaries;
- primary request, event, data, and failure flows;
- persistence and source-of-truth decisions;
- trust boundaries and identity flow;
- deployment/runtime assumptions;
- non-functional requirements and known limits;
- links to architecture decision records.

Do not confuse a directory tree with an architecture description. Explain responsibility, interaction, and trade-offs.

## API documentation

For each API group, document:

- purpose and consumer;
- method and path;
- authentication/authorization;
- request headers, parameters, and body;
- success response;
- meaningful error responses;
- side effects, audit behavior, and notifications;
- idempotency, rate, size, or replay constraints;
- an example only when it adds clarity.

Generate exact schemas from source when tooling supports it. If a table is summarized manually, state the source/version.

## Setup documentation

Use an ordered, testable path:

1. prerequisites;
2. dependency installation;
3. environment configuration;
4. database/bootstrap preparation;
5. build;
6. run;
7. smoke verification;
8. optional integrations;
9. troubleshooting.

Use placeholders for secrets. Explain which variables are required, optional, development-only, and production-only.

## Runbook structure

Every operational runbook should contain:

- purpose and trigger condition;
- prerequisites and required access;
- safety warnings;
- numbered procedure;
- expected output after each material step;
- verification of recovery/success;
- rollback or stop condition;
- escalation path;
- evidence to capture;
- last-tested date and owner.

Avoid commands that are destructive without an explicit verification and approval step.

## Handover structure

Include:

- current state and release/version;
- architecture and critical dependencies;
- environments and access ownership;
- deployment and rollback process;
- dashboards, alerts, logs, and SLOs;
- open risks/issues and upcoming changes;
- backup/recovery status;
- support model and escalation contacts;
- known tribal knowledge converted into explicit instructions;
- acceptance checklist for the receiving owner.

## Technical-documentation validation

- A new reader can identify the correct starting document.
- Setup commands work from the stated directory.
- Names match code, routes, schemas, and configuration.
- Every cross-reference resolves.
- No secret or sensitive personal data appears.
- Limitations and production assumptions are explicit.
- Runbooks include verification and rollback.
- Ownership and last-reviewed dates are present where operationally important.

