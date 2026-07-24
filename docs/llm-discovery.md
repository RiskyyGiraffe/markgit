# LLM discovery

Markgit exposes the same tool contract in four representations so an agent can use the least lossy format it supports.

| Format | Endpoint | Best for |
|---|---|---|
| Registry JSON | `/v1/registry/tools` | Search, ranking, and programmatic selection |
| Tool JSON docs | `/v1/registry/tools/{slug}/docs` | Exact call flow, examples, request and return shapes |
| OpenAPI 3.1 | `/v1/registry/tools/{slug}/openapi.json` | Tool importers and structured function generation |
| Plain text | `/v1/registry/tools/{slug}/llms.txt` | Retrieval, context injection, and models without OpenAPI tooling |

The global index is available at both:

- `https://api.markgit.com/v1/registry/llms.txt`
- `https://markgit.com/llms.txt`

## Contract guarantees

- Discovery endpoints require no authentication.
- `inputSchema` is the exact JSON object placed in the call request's `input` field.
- `outputSchema` describes the value returned in the normalized response's `output` field.
- Paid and tracked calls always quote before execution.
- The quote response separates provider price, Markgit fee, and exact total.
- An `Idempotency-Key` identifies one logical call and prevents duplicate execution and charging.
- Public usage labels bucket small tools as `Under 100 users` and `Under 1K invokes`.
- Usage counts include successful Markgit-mediated calls; direct provider traffic is outside Markgit's visibility.

## Recommended agent selection flow

1. Search `/v1/registry/tools?q={capability}`.
2. Filter by provider trust, price, schema compatibility, and usage.
3. Fetch `/v1/registry/tools/{slug}/docs` or the OpenAPI document.
4. Validate the intended input against `inputSchema`.
5. Request an exact quote.
6. Apply spend controls and obtain approval.
7. Call with the quote ID and a unique idempotency key.
8. Validate `output` against the documented `outputSchema`.
