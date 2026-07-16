# Prompting, RAG, and tools

Use this file when selecting the AI interaction pattern.

## Selection guidance

- use prompt-only when the job is narrow and stable
- add retrieval when fresh or proprietary knowledge is required
- add tools when the system must take actions or fetch deterministic data
- combine retrieval and tools only when each solves a distinct problem

## Good prompting behavior

- define the task and output format clearly
- provide only relevant context
- separate instructions from retrieved content
- avoid oversized context that lowers signal quality

## Tooling bar

If a tool call can change data, send messages, or trigger side effects, add validation and approval boundaries around it.
