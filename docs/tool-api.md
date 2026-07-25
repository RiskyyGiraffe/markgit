# Markgit Tool API v1

Markgit is a public registry and optional commerce protocol for tools hosted by their publishers. It is not an agent runtime and does not host provider implementations.

Production origins:

- Web catalog: `https://markgit.com/tools`
- API: `https://api.markgit.com`
- LLM index: `https://markgit.com/llms.txt`

## Machine-readable discovery

Discovery is public and requires no account.

```http
GET /v1/registry/tools?q=weather&limit=100&offset=0
GET /v1/registry/tools/{id-or-slug}
GET /v1/registry/tools/{id-or-slug}/docs
GET /v1/registry/tools/{id-or-slug}/openapi.json
GET /v1/registry/tools/{id-or-slug}/llms.txt
GET /v1/registry/llms.txt
```

Every tool card includes:

- provider identity and trust tier;
- price in USD;
- JSON input and output schemas;
- direct or gateway access metadata;
- successful Markgit invocation count and distinct authenticated-user count;
- privacy-friendly public labels such as `Under 100 users` and `Under 1K invokes`;
- links to JSON docs, OpenAPI 3.1, plain-text LLM docs, and the human-readable page.

Usage covers successful calls made through Markgit. A free tool can also expose its publisher endpoint directly; calls made entirely outside Markgit cannot be observed or counted.

## Install and link

```bash
npm install -g @markgit/cli
markgit login
```

`markgit login` starts short-lived device authorization, opens the portal, and stores the resulting scoped key at `~/.config/markgit/config.json` with owner-only permissions.

## Required tracked-call flow

### 1. Request an exact quote

```http
POST /v1/tools/{tool-slug}/quote
Authorization: Bearer mkgt_...
Content-Type: application/json

{}
```

Example response:

```json
{
  "quote": {
    "id": "quote-id",
    "priceUsd": "0.0100",
    "feeUsd": "0.0010",
    "totalUsd": "0.0110",
    "expiresAt": "2026-01-01T00:05:00.000Z"
  },
  "tool": { "id": "tool-id", "slug": "weather", "name": "Weather" },
  "controls": {
    "approved": true,
    "violations": []
  }
}
```

The caller must verify `controls.approved` and obtain user approval for `quote.totalUsd`, unless an existing maximum-cost policy already authorizes it.

### 2. Call with the approved quote

```http
POST /v1/tools/{tool-slug}/call
Authorization: Bearer mkgt_...
Idempotency-Key: 2c57b856-7d8e-42b1-9658-e19544c8fdce
Content-Type: application/json

{
  "quoteId": "quote-id",
  "input": { "city": "New York" }
}
```

Normalized response:

```json
{
  "id": "execution-id",
  "tool": { "id": "tool-id", "slug": "weather", "name": "Weather" },
  "status": "completed",
  "cost": {
    "priceUsd": "0.0100",
    "feeUsd": "0.0010",
    "totalUsd": "0.0110",
    "currency": "USD"
  },
  "output": { "temperature": 73 },
  "error": null
}
```

Repeating the same idempotency key returns the stored response without charging or executing again.

Free calls receive a zero-dollar quote. A linked CLI sends free calls through Markgit so successful usage is counted; an unlinked CLI can call a standardized free provider endpoint directly without tracking.

## Publish a hosted tool

Validate against [`../packages/tool-spec/markgit-tool.schema.json`](../packages/tool-spec/markgit-tool.schema.json), then onboard it:

```bash
markgit onboard ./markgit-tool.json
```

Manifest example:

```json
{
  "$schema": "./packages/tool-spec/markgit-tool.schema.json",
  "schemaVersion": "1",
  "provider": { "name": "Example Tools" },
  "name": "Weather lookup",
  "slug": "weather-lookup",
  "logoUrl": "https://example.com/weather-logo.svg",
  "description": "Returns current weather for a city.",
  "endpoint": {
    "url": "https://publisher.example/tools/weather",
    "method": "POST"
  },
  "inputSchema": {
    "type": "object",
    "required": ["city"],
    "properties": { "city": { "type": "string", "example": "New York" } }
  },
  "outputSchema": {
    "type": "object",
    "required": ["temperature"],
    "properties": { "temperature": { "type": "number" } }
  },
  "pricing": { "amountPerCallUsd": "0.0100" }
}
```

Examples and defaults in JSON Schema are used to generate representative request and response examples for agents.
