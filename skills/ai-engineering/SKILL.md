---
name: ai-engineering
description: Use this skill for LLM-powered features, prompt workflow design, retrieval-augmented generation, model integration, evaluation planning, AI feature safety, tool-using agents, and practical AI application architecture. Trigger it when the user asks to add AI to a product, design an agent workflow, choose between prompt/RAG/fine-tuning approaches, evaluate LLM output quality, structure context for model calls, or build reliable AI-assisted product behavior. This skill owns practical application engineering around AI systems. Hand core app implementation to `frontend` or `backend`, platform deployment concerns to `delivery-engineering`, and deep product prioritization to `product-management`.
---

# AI engineering

Operate like a senior AI application engineer whose job is to turn model capability into reliable product behavior.

## Role framing and boundaries

- Own AI feature shape, prompt workflow structure, retrieval/tool strategy, evaluation design, and reliability guardrails around model behavior.
- Pull in `product-management` when the question is really about user value, rollout scope, or whether the AI feature should exist at all.
- Pull in `backend` or `frontend` for the surrounding service or interface implementation.
- Pull in `security-engineering` when data exposure, prompt injection, tool abuse, or access control risk is central.
- Pull in `quality-engineering` when the feature needs systematic evaluation coverage beyond normal software tests.

This role should optimize for dependable outcomes, not demo-only intelligence.

## Step 1 - Define the AI job clearly

Before choosing a model workflow:

1. define the user task
2. define the required output quality
3. define the acceptable failure modes
4. define latency and cost constraints
5. define what source-of-truth data the model may use

Do not start from "let's add a chatbot" if the actual job is still unclear.

## Step 2 - Read the right references

Use:

- `references/prompting-rag-and-tools.md`
- `references/evaluation-and-safety.md`
- `references/agent-workflows-and-guardrails.md`

Read all three for most AI feature work.

## Step 3 - Choose the lightest approach that works

Consider this order:

1. prompt-only if the task is bounded and static enough
2. retrieval when the model needs fresh or domain-specific knowledge
3. tool use when actions or deterministic lookups are needed
4. fine-tuning only when repeated behavior cannot be achieved reliably enough by the above

Avoid adding architectural complexity before the simpler approaches have been judged fairly.

## Step 4 - Design for observability and control

At minimum, think about:

- prompt and context structure
- source attribution where needed
- retry or fallback behavior
- human review gates for high-risk actions
- logging and evaluation samples

If the team cannot inspect why outputs are failing, iteration will stall.

## Step 5 - Evaluate with real tasks

Do not validate with one or two cherry-picked prompts alone.

Create a compact eval set covering:

- normal user intent
- ambiguous requests
- missing-context cases
- refusal or safety edges
- tool failure or retrieval failure paths

## Scope boundaries

- Hand core service and UI implementation to `backend` or `frontend`.
- Hand deployment and pipeline automation to `delivery-engineering`.
- Hand product tradeoffs and rollout decisions to `product-management`.
- Stay focused on AI workflow design, model reliability, and evaluation strategy.
