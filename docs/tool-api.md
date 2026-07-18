# Markgit Tool API v1

Markgit is a registry and commerce protocol for tools hosted by their publishers. It is not an agent and it does not host provider implementations.

## Install and link

```bash
npm install -g @markgit/cli
markgit login
```

`markgit login` starts a short-lived device authorization. The CLI opens the portal, the user approves the displayed code, and the API returns a scoped key to that CLI exactly once. The key is stored at `~/.config/markgit/config.json` with owner-only permissions.

## Public discovery

Discovery does not require an account or API key.

```http
GET /v1/registry/tools?q=weather
GET /v1/registry/tools/open-meteo-current-weather
```

Every tool card contains provider identity and trust tier, JSON input/output schemas, transparent USD pricing, and an access mode:

- `direct`: a free standardized tool; call the publisher endpoint without Markgit in the data path.
- `gateway`: a paid or legacy tool; call the Markgit gateway for wallet authorization and settlement.

## Standard provider endpoint

A directly callable v1 endpoint accepts the JSON object described by `inputSchema` and returns the JSON value described by `outputSchema`.

```http
POST https://publisher.example/tools/weather
Content-Type: application/json

{"city":"New York"}
```

GET tools receive input properties as query parameters. Public endpoints must use HTTPS; localhost HTTP is permitted for development.

## Paid call

```http
POST /v1/tools/{tool-slug}/call
Authorization: Bearer mkgt_...
Idempotency-Key: 2c57b856-7d8e-42b1-9658-e19544c8fdce
Content-Type: application/json

{"input":{"city":"New York"}}
```

Markgit creates the quote and wallet hold internally, calls the publisher, captures on success, and returns one normalized response:

```json
{
  "id": "execution-id",
  "tool": { "id": "tool-id", "slug": "weather", "name": "Weather" },
  "status": "completed",
  "cost": { "amount": "0.0110", "currency": "USD" },
  "output": { "temperature": 73 },
  "error": null
}
```

Repeating the same idempotency key returns the stored response without charging or executing again.

## Publish a hosted tool

Validate against [`../packages/tool-spec/markgit-tool.schema.json`](../packages/tool-spec/markgit-tool.schema.json), then publish with an authenticated provider account:

```http
POST /v1/tools
Authorization: Bearer mkgt_...
Content-Type: application/json

{
  "schemaVersion": "1",
  "name": "Weather lookup",
  "slug": "weather-lookup",
  "description": "Returns current weather for a city.",
  "endpoint": {
    "url": "https://publisher.example/tools/weather",
    "method": "POST"
  },
  "inputSchema": {
    "type": "object",
    "required": ["city"],
    "properties": { "city": { "type": "string" } }
  },
  "outputSchema": {
    "type": "object",
    "properties": { "temperature": { "type": "number" } }
  },
  "pricing": { "amountPerCallUsd": "0.0100" }
}
```

The initial listing is a draft and follows the existing review/publish workflow.
