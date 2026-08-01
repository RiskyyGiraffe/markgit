# Markgit Tool, Harness, MCP, and Skill Specs

This package contains the open manifest for tools hosted by their publisher and listed through Markgit.

- `markgit-tool.schema.json` describes an atomic tool: one request, one response, and `pricing.amountPerCallUsd`.
- `markgit-harness.schema.json` describes a durable loop: one free Markgit start creates a monitored run with explicit access, external API pricing, loop limits, and compaction behavior.
- `markgit-mcp.schema.json` describes a remote MCP server: clients connect directly using its declared transport, authentication, and tool surface.
- `markgit-skill.schema.json` describes a source-hosted `SKILL.md` package with provenance, compatibility, and non-automatic install guidance.

- `pricing.amountPerCallUsd: "0"` makes a standardized endpoint directly callable from the public registry.
- A positive price routes calls through Markgit for wallet authorization, metering, and settlement.
- Harnesses are always free through Markgit. Their manifests disclose whether third-party API costs are included or use user-supplied accounts; those costs are not charged by Markgit.
- MCP listings are always free through Markgit. Markgit versions and verifies metadata but never proxies MCP traffic.
- Skill listings are always free through Markgit. Markgit indexes metadata and source provenance but never hosts or automatically executes their code.
- Markgit hosts registry metadata and commerce; it does not host the tool implementation.
- `logoUrl` is optional and must be an HTTPS URL. When omitted or unavailable, Markgit renders a category-aware default mark.

See [`../../docs/tool-api.md`](../../docs/tool-api.md) for the HTTP contract.
See [`../../docs/harness-api.md`](../../docs/harness-api.md) for the vendor-neutral harness start, event, monitor, and cancel contracts.
See [`../../docs/mcp-api.md`](../../docs/mcp-api.md) for MCP publishing, discovery, and direct connection contracts.

Each active tool automatically receives public JSON docs, OpenAPI 3.1, and `llms.txt` endpoints generated from this manifest's input and output schemas. Include JSON Schema `example`, `examples`, `default`, and `enum` values when possible so agents receive representative payloads.
