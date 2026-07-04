# Python — stack reference

Read this after Step 0 of `SKILL.md` has determined the architecture shape and that Python is the chosen language. This file covers framework choice, the now-standard tooling stack, the async database layer, and idioms specific to this ecosystem. The Step 1 engineering bars in `SKILL.md` still apply — this file adds the Python-specific *how*.

## Framework choice

| Framework | Choose when |
|---|---|
| **FastAPI** | The default greenfield choice for building an API. Async-first, integrates natively with Pydantic v2 for validation, generates OpenAPI docs automatically, and has become the standard choice for AI/LLM inference backends specifically — the FastAPI + Pydantic + LangChain/LangGraph combination is now the default Python AI backend stack. Choose this unless there's a specific reason for Django below. |
| **Django (+ Django REST Framework)** | Building a full-stack application that needs an admin panel, built-in auth, a mature ORM, and content-management-style features out of the box — not just an API. Django's async support matured significantly through Django 5.x (async views and Django Channels are now production-ready), so it's no longer automatically the wrong choice for async-heavy work the way it was a few years ago. |
| **Flask** | Maintaining an existing Flask codebase, or a genuinely minimal single-purpose service where FastAPI's extra structure adds nothing. Don't default to Flask for a new multi-endpoint API in 2026 — it hasn't evolved to match async-first, type-safe development patterns, and is increasingly the legacy choice for new work. |

**A common, well-regarded real architecture**: Django for the admin/CMS layer, FastAPI for the high-performance API layer, deployed as separate services. This keeps Django's batteries-included strengths and FastAPI's async/performance advantages each where they fit best, rather than forcing one framework to do both jobs.

## Tooling: uv is now the standard

**Use `uv` for new Python projects, not `pip` + `venv` and not Poetry**, unless there's a specific reason to match an existing team's tooling. This is a genuine, broad ecosystem shift, not a niche preference: `uv` is 10-100x faster than pip, manages Python versions, virtual environments, and dependency locking in one Rust-based binary, with no separate `pip install` / `venv activate` dance required.

```bash
# New project setup
uv init my-api
cd my-api
uv add fastapi "uvicorn[standard]" sqlalchemy asyncpg alembic pydantic-settings
uv add --dev pytest pytest-asyncio httpx ruff mypy

# Day to day
uv run uvicorn main:app --reload   # run inside the project's managed venv, no activation needed
uv sync                             # install exactly what uv.lock specifies
uv add <package>                    # add + resolve + lock + sync in one step
```

- `uv.lock` is the cross-platform, fully-resolved lockfile — **always commit it**, the same as `package-lock.json` or `uv.lock`'s equivalents in other ecosystems. `pip freeze > requirements.txt` only captures what happens to be installed locally, not a deterministic cross-platform resolution — this is the core problem `uv.lock` actually solves.
- For an existing Poetry or pip project, `uv` can read an existing `pyproject.toml` directly (`uv sync`) or import from `requirements.txt` (`uv add -r requirements.txt`) — migrating doesn't require starting from scratch.
- Don't migrate an existing, working Poetry setup purely for the speed win unless the team is feeling real pain from it — same principle as not migrating a working framework or ORM without cause.
- **Ruff** (also by Astral, the `uv` team) has consolidated what used to be a stack of separate tools (Flake8, isort, pycodestyle, autoflake, pyupgrade, Black) into one fast Rust-based linter/formatter. Use it as the default linting/formatting choice for new projects rather than assembling the older multi-tool stack.

## Async database layer

**SQLAlchemy 2.0's native async support** (`create_async_engine` + `AsyncSession`) is the standard for async APIs — this was a substantial rewrite from SQLAlchemy 1.x's async story, so don't pattern-match to older SQLAlchemy tutorials that predate it.

```python
# Async engine + session setup
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/db")
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# FastAPI dependency injection — the idiomatic pattern
from typing import Annotated
from fastapi import Depends

async def get_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_session)]

@app.get("/users/{user_id}")
async def get_user(user_id: int, session: SessionDep):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

- **Never mix sync and async database calls in the same request path** — calling a synchronous DB driver from an async route handler blocks the event loop for every concurrent request being served by that worker, not just the current one. This is the Python equivalent of the Node.js "don't block the event loop" warning, and it's just as easy to introduce accidentally (e.g. an ORM call that looks async but resolves to a sync driver underneath).
- Use `asyncpg` as the PostgreSQL driver for async SQLAlchemy — it's the standard pairing.
- For raw SQL when the query builder doesn't express something cleanly, use `session.execute(text(...), params)` with bound parameters — never f-string or `.format()` user input into the SQL string, same rule as every other stack in this skill.
- **SQLModel** (built by FastAPI's author) is worth considering when a project wants a single model definition that's simultaneously a Pydantic model (for request/response validation) and a SQLAlchemy model (for the database) — it reduces duplication between the API schema and the DB schema, at the cost of slightly less flexibility than using each library separately for its own concern.
- **Alembic** remains the standard migration tool alongside SQLAlchemy — generate migrations from model changes (`alembic revision --autogenerate`), but always review the generated migration before applying it; autogenerate doesn't always correctly detect things like column renames (it may generate a drop + add instead).

## Concurrency model

- Python's `async`/`await` solves I/O-bound concurrency (waiting on network/disk) — it does not parallelize CPU-bound work, and the GIL (Global Interpreter Lock) means a single Python process still only runs one thread of Python bytecode at a time regardless of `async`.
- For genuinely CPU-bound work (image processing, heavy computation), use multiprocessing or hand off to a worker queue (Celery is the long-standing standard; for simpler needs, a lighter task queue is often sufficient) rather than expecting `async def` to parallelize it — `async` and "runs on another core" are not the same thing.
- For most typical CRUD API workloads, async I/O concurrency (handling many simultaneous waiting-on-the-database requests efficiently) is what actually matters, and FastAPI's async support addresses exactly this.

## Testing

- **pytest** is the standard test runner, with **pytest-asyncio** for testing async functions and routes directly.
- **Use `httpx.AsyncClient`, not FastAPI's synchronous `TestClient`, when testing async routes that touch the database.** The synchronous `TestClient` can block the event loop and produce flaky, inconsistent results specifically when the route under test is itself async and doing real async I/O — this is a common, easy-to-miss source of test flakiness that looks like a database issue but is actually a test-client mismatch.
- Use a real (or realistic, e.g. a test-specific schema/database) Postgres instance for integration tests that exercise actual queries — SQLite-backed tests can pass while missing PostgreSQL-specific behavior (constraint enforcement details, certain index behaviors) that only shows up against the real engine.
- Structure fixtures so each test gets a clean, isolated transaction or schema — tests that leak state into each other (especially under parallel execution via `pytest-xdist`) produce intermittent, hard-to-reproduce failures that erode trust in the suite.
- `asyncio_mode = "auto"` in `pytest.ini`/`pyproject.toml` lets `pytest-asyncio` automatically detect async test functions without needing `@pytest.mark.asyncio` on every single one — convenient, but confirm the project has actually opted into this mode before assuming async tests will "just work" without the marker.

## Anti-patterns to flag in review

- A synchronous database call inside an `async def` route handler — blocks the event loop for every concurrent request on that worker.
- F-string or `.format()`-built SQL strings instead of parameterized queries, regardless of whether SQLAlchemy Core, the ORM, or raw `text()` is being used.
- Using FastAPI's synchronous `TestClient` to test genuinely async, database-touching routes, then debugging the resulting flakiness as if it were a database problem.
- Treating `async def` as a substitute for actual parallelism on CPU-bound work — it doesn't get around the GIL.
- A new multi-endpoint API project starting on Flask in 2026 without a specific reason tying it to existing Flask infrastructure.
- Blindly applying an Alembic autogenerated migration without reviewing whether it correctly captured the intended schema change (especially renames, which autogenerate often mishandles).
- Still using `pip install` + manually maintained `requirements.txt` for a brand-new project with no constraint pointing away from `uv`.
