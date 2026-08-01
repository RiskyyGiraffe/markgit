import asyncio
import hmac
import os
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Markgit goal-loop demo provider", version="1.0.0")
cancelled: set[str] = set()


def require_provider_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("MARKGIT_PROVIDER_TOKEN", "")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not expected or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid provider token")


class GoalDataInput(BaseModel):
    goal: str = Field(min_length=1, max_length=500)
    step: int = Field(ge=1, le=5)
    targetSteps: int = Field(default=3, ge=1, le=5)


class StartEnvelope(BaseModel):
    protocol: str
    run: dict[str, Any]
    callbacks: dict[str, str]


class CancelEnvelope(BaseModel):
    protocol: str
    runId: str
    providerRunId: str | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "markgit-custom-loop-demo"}


@app.get("/.well-known/markgit.json")
async def origin_verification() -> dict[str, str]:
    provider_id = os.environ.get("MARKGIT_PROVIDER_ID", "")
    challenge = os.environ.get("MARKGIT_ORIGIN_CHALLENGE", "")
    if not provider_id or not challenge:
        raise HTTPException(status_code=404, detail="Origin verification is not configured")
    return {"providerId": provider_id, "challenge": challenge}


@app.post("/data/next", dependencies=[Depends(require_provider_token)])
async def next_goal_data(payload: GoalDataInput) -> dict[str, Any]:
    return {
        "goal": payload.goal,
        "step": payload.step,
        "datum": f"verified-demo-datum-{payload.step}",
        "goalAchieved": payload.step >= payload.targetSteps,
    }


async def post_callback(client: httpx.AsyncClient, url: str, token: str, body: dict[str, Any]) -> dict[str, Any]:
    response = await client.post(url, json=body, headers={"Authorization": f"Bearer {token}"})
    response.raise_for_status()
    return response.json()


async def run_goal_loop(envelope: StartEnvelope) -> None:
    run_id = str(envelope.run["id"])
    events_url = envelope.callbacks["eventsUrl"]
    tool_url = envelope.callbacks["toolCallUrlTemplate"].replace("{slug}", "penguin-goal-data")
    token = envelope.callbacks["token"]
    goal = str(envelope.run["input"]["goal"])
    target_steps = int(envelope.run["input"].get("targetSteps", 3))
    observations: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            for step in range(1, 6):
                if run_id in cancelled:
                    return
                await post_callback(client, events_url, token, {
                    "type": "loop.step.started",
                    "message": f"Evaluating goal at step {step}",
                    "data": {"step": step, "goal": goal},
                })
                tool_response = await client.post(
                    tool_url,
                    json={"input": {"goal": goal, "step": step, "targetSteps": target_steps}},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Idempotency-Key": f"{run_id}:goal-data:{step}",
                    },
                )
                tool_response.raise_for_status()
                delegated = tool_response.json()["result"]
                if delegated["execution"]["status"] != "completed":
                    raise RuntimeError(delegated["execution"].get("errorMessage") or "Tool call failed")
                observation = delegated["execution"]["output"]
                observations.append(observation)
                achieved = bool(observation.get("goalAchieved"))
                await post_callback(client, events_url, token, {
                    "type": "goal.evaluated",
                    "message": "Goal achieved" if achieved else "Goal not achieved; continuing",
                    "data": {"step": step, "goalAchieved": achieved, "completionField": "goalAchieved"},
                })
                await post_callback(client, events_url, token, {
                    "type": "loop.step.completed",
                    "message": f"Completed goal step {step}",
                    "data": {"step": step},
                })
                if achieved:
                    await post_callback(client, events_url, token, {
                        "type": "run.completed",
                        "message": "The declared goal condition was achieved",
                        "data": {"output": {"goalAchieved": True, "steps": step, "observations": observations}},
                    })
                    return
            raise RuntimeError("Goal was not achieved within the declared step limit")
    except Exception as exc:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await post_callback(client, events_url, token, {
                    "type": "run.failed",
                    "message": "Custom loop failed",
                    "data": {"error": str(exc)[:1000]},
                })
        except Exception:
            pass


@app.post("/loops/start", dependencies=[Depends(require_provider_token)])
async def start_loop(envelope: StartEnvelope) -> dict[str, str]:
    asyncio.create_task(run_goal_loop(envelope))
    return {"status": "running", "providerRunId": f"penguin-{envelope.run['id']}"}


@app.post("/loops/cancel", dependencies=[Depends(require_provider_token)])
async def cancel_loop(envelope: CancelEnvelope) -> dict[str, bool]:
    cancelled.add(envelope.runId)
    return {"cancelled": True}
