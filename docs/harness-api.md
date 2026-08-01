# Markgit harness protocol

Markgit distinguishes two marketplace primitives:

- A **tool** is atomic: one approved request produces one normalized response.
- A **harness** is durable: one approved start creates a provider-hosted agent loop that can be monitored or cancelled later.

Markgit does not host the loop or its compute. It standardizes discovery, approval, run identity, shared monitoring, and the audit trail. Markgit does not charge for harness runs; commerce applies only to atomic tools.

## Public discovery

- `GET /v1/registry/harnesses`
- `GET /v1/registry/harnesses/{slug}`
- `GET /v1/registry/harnesses/{slug}/docs`
- `GET /v1/registry/harnesses/{slug}/openapi.json`
- `GET /v1/registry/harnesses/{slug}/llms.txt`

Every harness exposes its complete frozen access manifest, free Markgit charge, external API cost policy, external API prices, loop bounds, compaction behavior, provider trust, and immutable manifest digest. External costs are disclosure only: they are either included by the provider or use accounts supplied by the user.

## Agent flow

1. Inspect the public harness listing and review `pricing`, `access`, `loop`, `compaction`, and `policy`.
2. Approve the exact immutable manifest when policy requires it.
3. Start with `POST /v1/harnesses/{slug}/runs`, an `Idempotency-Key`, input, and exact manifest approval when required.
4. Read the snapshot at `GET /v1/harness-runs/{runId}`.
5. Poll append-only events with `GET /v1/harness-runs/{runId}/events?after={sequence}`.
6. Cancel with `POST /v1/harness-runs/{runId}/cancel`.

The monitor contract is plain HTTP and JSON. Codex, Claude, or any other HTTP-capable agent can read the same run using a Markgit API key belonging to the run owner.

## Provider start contract

After policy approval and rate-limit checks, Markgit sends `POST runtime.startUrl`:

```json
{
  "protocol": "markgit.harness/v1",
  "run": {
    "id": "uuid",
    "input": {},
    "access": {},
    "loop": {},
    "compaction": {},
    "pricing": {}
  },
  "callbacks": {
    "eventsUrl": "https://api.markgit.com/v1/harness-callbacks/{runId}/events",
    "token": "per-run-secret"
  }
}
```

The provider returns `{"status":"running","providerRunId":"optional"}`. No wallet hold, purchase, settlement, or Markgit charge is created for the run. Any declared third-party API cost remains governed by the provider or the user's external account.

## Provider events

The provider posts events to `callbacks.eventsUrl` with `Authorization: Bearer <callbacks.token>`.

```json
{
  "type": "external_api.call",
  "message": "Queried public search results",
  "data": {
    "apiId": "search-api",
    "operation": "search",
    "actualCostUsd": "0.0020"
  }
}
```

Markgit rejects `external_api.call` unless `apiId` exists in the run's frozen `access.externalApis`. The returned event is enriched with the declared API origin, purpose, data sent, data received, and pricing. `markgit_tool.call` similarly requires a declared tool slug.

Terminal events are `run.completed` and `run.failed`. Context changes should use `compaction.started`, `compaction.completed`, and `checkpoint.created` so every monitoring agent sees when history changed and what the harness promised to preserve.
