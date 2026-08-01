import asyncio
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Markgit observable harness example")
cancelled: set[str] = set()


class StartEnvelope(BaseModel):
    protocol: str
    run: dict[str, Any]
    callbacks: dict[str, str]


class CancelEnvelope(BaseModel):
    protocol: str
    runId: str
    providerRunId: str | None = None


async def emit(url: str, token: str, event: dict[str, Any]) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, json=event, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()


async def loop(envelope: StartEnvelope) -> None:
    run_id = str(envelope.run["id"])
    events_url = envelope.callbacks["eventsUrl"]
    token = envelope.callbacks["token"]
    for step in range(1, 4):
        if run_id in cancelled:
            return
        await emit(events_url, token, {
            "type": "loop.step.started",
            "message": f"Starting example step {step}",
            "data": {"step": step},
        })
        await asyncio.sleep(0.25)
        await emit(events_url, token, {
            "type": "loop.step.completed",
            "message": f"Completed example step {step}",
            "data": {"step": step},
        })
    await emit(events_url, token, {
        "type": "compaction.started",
        "message": "Compacting the example loop context",
        "data": {"strategy": "checkpoint"},
    })
    await emit(events_url, token, {
        "type": "compaction.completed",
        "message": "Created a compact checkpoint",
        "data": {"preserved": ["goal", "completed steps", "final result"]},
    })
    await emit(events_url, token, {
        "type": "run.completed",
        "message": "Example loop completed",
        "data": {"output": {"answer": f"Finished: {envelope.run['input'].get('goal', 'example goal')}"}},
    })


@app.post("/runs")
async def start_run(envelope: StartEnvelope) -> dict[str, str]:
    asyncio.create_task(loop(envelope))
    return {"status": "running", "providerRunId": f"example-{envelope.run['id']}"}


@app.post("/cancel")
async def cancel_run(envelope: CancelEnvelope) -> dict[str, bool]:
    cancelled.add(envelope.runId)
    return {"cancelled": True}
