from datetime import datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="Markgit Local Text Tool",
    description="A tiny publisher-hosted API used to test Markgit discovery and billing.",
    version="1.0.0",
)


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    uppercase: bool = False


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, object]:
    transformed = request.text.upper() if request.uppercase else request.text
    return {
        "text": transformed,
        "wordCount": len(request.text.split()),
        "characterCount": len(request.text),
        "processedAt": datetime.now(timezone.utc).isoformat(),
    }
