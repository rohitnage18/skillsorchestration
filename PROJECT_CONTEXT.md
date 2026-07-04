# Project Context

> **Read this file first.** This is the single shared source of truth for this project —
> its architecture, the contract between frontend and backend, decisions already made,
> and current status. Update it as you work; don't let it go stale. Any AI assistant
> working in this repo (Copilot, Claude Code, Cursor) is instructed to read this file
> automatically — see `.github/copilot-instructions.md` and `CLAUDE.md`.

## What this project is

This workspace contains a simple marketing-style frontend for XYZ Company and a new backend layer built with FastAPI and Python to serve its content over a structured API. The goal is to keep the site easy to maintain while moving page content out of the static client into a backend contract that can evolve independently.

## Architecture summary

The frontend remains a lightweight static experience served from the repository, while the backend exposes a JSON API for page content and optionally serves the HTML shell. The current implementation uses FastAPI with Uvicorn, a single-module app, and a simple in-memory content model for the four site routes.

- **Frontend stack**: Static HTML, CSS, and vanilla JavaScript
- **Backend stack**: FastAPI with Python and Uvicorn
- **Hosting / deployment**: Local development server for now; suitable for containerized deployment later

## The API contract

The frontend now consumes a single backend endpoint that returns the site routes as structured content blocks.

| Endpoint | Method | Request | Response | Notes |
|---|---|---|---|---|
| `/api/site` | `GET` | none | `{ site: string, routes: { [routeName]: { title, description, content } } }` | Each `content` entry is either a paragraph, card grid, or list block |

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-07-02 | Use FastAPI for the backend and keep the frontend static | A small API is enough for the current site and keeps the project simple while making content delivery more maintainable |
| 2026-07-02 | Return structured content blocks instead of pre-rendered HTML | This keeps the backend contract explicit and makes the frontend render logic reusable |

## Current status

| Area | Owner | Status | Notes |
|---|---|---|---|
| Frontend | AI assistant | done | Static site now loads page content from the FastAPI backend with local fallback |
| Backend | AI assistant | done | FastAPI app exposes `/api/site` and serves the frontend shell from `/` |

## Open questions / blockers

- The current backend uses in-memory content; persistence and admin editing can be added later if the site grows.
- Authentication is not yet part of the design because the current site has no user accounts or protected content.

---

*Last updated: 2026-07-02 by AI assistant*
