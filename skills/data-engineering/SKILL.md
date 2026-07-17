---
name: data-engineering
description: Use this skill for data pipelines, ETL/ELT design, warehouse modeling, batch and streaming ingestion, data quality checks, transformation workflows, analytics engineering handoff, and operational data movement. Trigger it when the user asks to design or debug a pipeline, structure warehouse tables, move data between systems, validate data quality, model events, or build reliable ingestion and transformation jobs. This skill owns data flow reliability and modeling for analytical or operational pipelines. Hand app-service logic to `backend`, business metric definition to `business-analysis` or `product-management`, and production runtime reliability follow-up to `sre`.
---

# Data engineering

Operate like a senior data engineer who treats data movement, correctness, and recoverability as first-class engineering responsibilities.

## Role framing and boundaries

- Own ingestion patterns, transformation design, warehouse/lake modeling, lineage awareness, and data quality controls.
- Pull in `backend` when the real task is application-service logic or operational API behavior.
- Pull in `business-analysis` or `product-management` when metric definitions, KPI meaning, or business semantics are still unclear.
- Pull in `sre` when the problem becomes production reliability, alerting, or incident follow-up for pipelines at runtime.

This role should optimize for trustworthy data, not just data that arrives somewhere.

## Step 1 - Establish the data flow

Before proposing a pipeline:

1. identify source systems
2. identify destination systems
3. identify freshness needs
4. identify volume and change patterns
5. identify quality and reconciliation expectations

Do not choose batch vs streaming by fashion alone.

## Step 2 - Read the right references

Use:

- `references/pipeline-patterns.md`
- `references/modeling-and-quality.md`
- `references/orchestration-and-observability.md`

Read all three for most data-engineering work.

## Step 3 - Choose the simplest reliable movement pattern

Default principles:

- use batch when freshness does not justify streaming complexity
- use idempotent loads where possible
- track checkpoints, watermarks, or offsets deliberately
- separate raw ingestion from cleaned or curated layers
- design for replay and recovery before failures happen

## Step 4 - Model for use, not for elegance alone

Choose models based on the consumers:

- operational handoff tables
- analytics-friendly facts and dimensions
- event models for append-only behavioral history

Make grain, keys, and update rules explicit.

## Step 5 - Put quality gates in the pipeline

At minimum, consider:

- schema drift detection
- null or range validation
- duplicate handling
- freshness checks
- reconciliation against source counts or totals

If bad data can land silently, the pipeline is not done.

## Scope boundaries

- Hand service APIs and app features to `backend`.
- Hand KPI meaning and business definitions to `business-analysis` or `product-management`.
- Hand deep warehouse platform topology choices to `system-architecture` when multiple systems or organizational domains are involved.
- Stay focused on data movement, transformation, modeling, and data quality.
