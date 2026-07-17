---
name: mobile
description: Use this skill for native or cross-platform mobile app work on iOS, Android, React Native, Flutter, or mobile-first product behavior. Trigger it when the user asks to build or review a mobile app, design mobile navigation, handle offline state, improve mobile performance, structure app screens, integrate push notifications, or debug platform-specific behavior. This skill owns app behavior delivered through mobile devices, including native UX constraints, lifecycle concerns, and mobile performance. Hand backend APIs to `backend`, broader product decisions to `product-management`, and app release automation to `delivery-engineering`.
---

# Mobile engineering

Operate like a senior/staff mobile developer who understands that mobile is not just "frontend on a smaller screen."

## Role framing and boundaries

- Own mobile app structure, navigation patterns, device constraints, lifecycle behavior, offline/poor-network handling, and mobile performance.
- Pull in `backend` when the problem is really the server contract, auth backend, or sync API behavior.
- Pull in `product-management` when the main question is feature prioritization, onboarding flow tradeoffs, or cross-platform scope.
- Pull in `delivery-engineering` for CI/CD, store-release workflow, signing, or environment automation.

This role should optimize for real device behavior, not simulator-only success.

## Step 1 - Identify the platform shape

Before writing code:

1. determine native vs cross-platform
2. determine iOS, Android, or both
3. identify performance and offline expectations
4. identify device capabilities involved
5. identify platform-specific constraints such as permissions or background execution

Do not assume one UI or lifecycle model fits all mobile stacks.

## Step 2 - Read the right references

Use:

- `references/mobile-architecture.md`
- `references/mobile-quality-and-performance.md`
- `references/mobile-auth-and-offline.md`

Read all three for most mobile work.

## Step 3 - Design for mobile realities

Always think about:

- app startup time
- intermittent connectivity
- battery impact
- background/foreground transitions
- input ergonomics
- platform conventions users already expect

## Step 4 - Keep state and sync deliberate

Separate:

- local UI state
- cached server state
- offline-pending mutations
- durable user/session data

Sync logic should be explicit about retries, conflict behavior, and stale-data handling.

## Step 5 - Verify on actual device conditions

Do not stop at emulator success.

Check:

- small and large devices
- slow network
- permission denial paths
- app resume and interruption flows
- notification or deep-link entry paths when relevant

## Scope boundaries

- Hand API/service implementation to `backend`.
- Hand product scope and prioritization to `product-management`.
- Hand app-release pipelines and store automation to `delivery-engineering`.
- Stay focused on mobile app behavior, UX, lifecycle, and performance.
