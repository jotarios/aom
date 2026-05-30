"""FastAPI wrapper for Agent B. Runs the hub-driven engine as a background task and
exposes a health probe + a manual trigger endpoint (the bridge can POST here too)."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.engine import AgentB, build_agent

_agent: AgentB | None = None
_task: asyncio.Task[None] | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN201
    global _agent, _task
    _agent = build_agent()
    _task = asyncio.create_task(_agent.run())
    yield
    if _task:
        _task.cancel()


app = FastAPI(title="AOM Agent B — Geospatial Engine", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "scenario": _agent.scenario.id if _agent else None,
        "agentB": _agent.signer.address if _agent else None,
    }


@app.post("/trigger/{task_id}")
async def trigger(task_id: str) -> dict[str, object]:
    """Manual intercept trigger (the Rust bridge fires this on a ring read in live mode)."""
    if _agent is None:
        return {"ok": False, "error": "agent not ready"}
    asyncio.create_task(_agent.handle_intercept(task_id))
    return {"ok": True, "taskId": task_id}
