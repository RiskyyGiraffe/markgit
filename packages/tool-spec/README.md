# Markgit Tool Spec

This package contains the open manifest for tools hosted by their publisher and listed through Markgit.

- `pricing.amountPerCallUsd: "0"` makes a standardized endpoint directly callable from the public registry.
- A positive price routes calls through Markgit for wallet authorization, metering, and settlement.
- Markgit hosts registry metadata and commerce; it does not host the tool implementation.
- `logoUrl` is optional and must be an HTTPS URL. When omitted or unavailable, Markgit renders a category-aware default mark.

See [`../../docs/tool-api.md`](../../docs/tool-api.md) for the HTTP contract.

Each active tool automatically receives public JSON docs, OpenAPI 3.1, and `llms.txt` endpoints generated from this manifest's input and output schemas. Include JSON Schema `example`, `examples`, `default`, and `enum` values when possible so agents receive representative payloads.
