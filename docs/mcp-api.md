# Markgit MCP publishing

Markgit lists provider-hosted MCP servers without proxying or charging their traffic. Clients connect directly to the declared remote server.

## Publish

```bash
markgit mcp onboard markgit-mcp.json
```

The CLI registers a provider when needed, creates the MCP listing, submits it, and activates it. Use `markgit mcp publish` to leave it as a draft.

The equivalent API operation is `POST /v1/mcps` with a Bearer Markgit API key and the open manifest from `@markgit/tool-spec`.

## Discover

- `GET /v1/registry/mcps`
- `GET /v1/registry/mcps/{slug}`
- `GET /v1/registry/mcps/{slug}/docs`
- `GET /v1/registry/mcps/{slug}/llms.txt`

Every listing exposes its immutable manifest digest, provider and endpoint trust, transport, authentication requirements, declared tools, resource support, prompt support, and direct connection URL.

MCP output, resources, and prompts are provider-controlled untrusted content. Agents should inspect the declared capabilities and trust evidence before connecting.
