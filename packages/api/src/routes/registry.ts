import { Hono } from 'hono';
import {
  getPublicTool,
  listAllPublicTools,
  listPublicTools,
  listPublicToolVersions,
} from '../services/registry.js';
import {
  buildRegistryLlmsText,
  buildToolDocumentation,
  buildToolLlmsText,
  buildToolOpenApi,
} from '../lib/tool-docs.js';
import {
  buildHarnessDocumentation,
  buildHarnessLlmsText,
  buildHarnessOpenApi,
  buildHarnessRegistryLlmsText,
} from '../lib/harness-docs.js';
import {
  getPublicHarness,
  listAllPublicHarnesses,
  listPublicHarnesses,
  listPublicHarnessVersions,
} from '../services/harness-registry.js';
import { buildMcpDocumentation, buildMcpLlmsText, buildMcpRegistryLlmsText } from '../lib/mcp-docs.js';
import { getPublicMcp, listAllPublicMcps, listPublicMcps, listPublicMcpVersions } from '../services/mcp-registry.js';

const registry = new Hono();

registry.get('/', (c) => c.json({
  name: 'Markgit Agent Marketplace Registry',
  version: '1',
  description: 'Public discovery and optional commerce for atomic tools, plus free durable harnesses and direct MCP servers.',
  authentication: {
    discovery: 'none',
    paidCalls: 'Bearer API key',
  },
  endpoints: {
    search: 'GET /v1/registry/tools?q={query}',
    inspect: 'GET /v1/registry/tools/{id-or-slug}',
    docs: 'GET /v1/registry/tools/{id-or-slug}/docs',
    openapi: 'GET /v1/registry/tools/{id-or-slug}/openapi.json',
    llms: 'GET /v1/registry/llms.txt',
    toolLlms: 'GET /v1/registry/tools/{id-or-slug}/llms.txt',
    versions: 'GET /v1/registry/tools/{id-or-slug}/versions',
    quote: 'POST /v1/tools/{id-or-slug}/quote',
    call: 'POST /v1/tools/{id-or-slug}/call',
    harnessSearch: 'GET /v1/registry/harnesses?q={query}',
    harnessInspect: 'GET /v1/registry/harnesses/{id-or-slug}',
    harnessDocs: 'GET /v1/registry/harnesses/{id-or-slug}/docs',
    harnessLlms: 'GET /v1/registry/harnesses/{id-or-slug}/llms.txt',
    harnessStart: 'POST /v1/harnesses/{id-or-slug}/runs',
    harnessMonitor: 'GET /v1/harness-runs/{runId}',
    mcpSearch: 'GET /v1/registry/mcps?q={query}',
    mcpInspect: 'GET /v1/registry/mcps/{id-or-slug}',
    mcpDocs: 'GET /v1/registry/mcps/{id-or-slug}/docs',
    mcpPublish: 'POST /v1/mcps',
  },
}));

registry.get('/llms.txt', async (c) => {
  const [tools, harnesses, mcps] = await Promise.all([listAllPublicTools(), listAllPublicHarnesses(), listAllPublicMcps()]);
  const origin = new URL(c.req.url).origin;
  return c.text(`${buildRegistryLlmsText(tools, origin)}\n${buildHarnessRegistryLlmsText(harnesses, origin)}\n${buildMcpRegistryLlmsText(mcps, origin)}`, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
});

registry.get('/mcps', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await listPublicMcps(c.req.query('q') ?? '', limit, offset));
});

registry.get('/mcps/:identifier/docs', async (c) => {
  const mcp = await getPublicMcp(c.req.param('identifier'));
  return c.json(buildMcpDocumentation(mcp, new URL(c.req.url).origin));
});

registry.get('/mcps/:identifier/llms.txt', async (c) => {
  const mcp = await getPublicMcp(c.req.param('identifier'));
  return c.text(buildMcpLlmsText(mcp, new URL(c.req.url).origin), 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

registry.get('/mcps/:identifier/versions', async (c) => c.json(await listPublicMcpVersions(c.req.param('identifier'))));
registry.get('/mcps/:identifier', async (c) => c.json(await getPublicMcp(c.req.param('identifier'))));

registry.get('/harnesses', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await listPublicHarnesses(c.req.query('q') ?? '', limit, offset));
});

registry.get('/harnesses/:identifier/docs', async (c) => {
  const harness = await getPublicHarness(c.req.param('identifier'));
  return c.json(buildHarnessDocumentation(harness, new URL(c.req.url).origin));
});

registry.get('/harnesses/:identifier/openapi.json', async (c) => {
  const harness = await getPublicHarness(c.req.param('identifier'));
  return c.json(buildHarnessOpenApi(harness, new URL(c.req.url).origin));
});

registry.get('/harnesses/:identifier/llms.txt', async (c) => {
  const harness = await getPublicHarness(c.req.param('identifier'));
  return c.text(buildHarnessLlmsText(harness, new URL(c.req.url).origin), 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
});

registry.get('/harnesses/:identifier/versions', async (c) => {
  return c.json(await listPublicHarnessVersions(c.req.param('identifier')));
});

registry.get('/harnesses/:identifier', async (c) => c.json(await getPublicHarness(c.req.param('identifier'))));

registry.get('/tools', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await listPublicTools(c.req.query('q') ?? '', limit, offset));
});

registry.get('/tools/:identifier/docs', async (c) => {
  const tool = await getPublicTool(c.req.param('identifier'));
  return c.json(buildToolDocumentation(tool, new URL(c.req.url).origin));
});

registry.get('/tools/:identifier/openapi.json', async (c) => {
  const tool = await getPublicTool(c.req.param('identifier'));
  return c.json(buildToolOpenApi(tool, new URL(c.req.url).origin));
});

registry.get('/tools/:identifier/llms.txt', async (c) => {
  const tool = await getPublicTool(c.req.param('identifier'));
  return c.text(buildToolLlmsText(tool, new URL(c.req.url).origin), 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
});

registry.get('/tools/:identifier/versions', async (c) => {
  return c.json(await listPublicToolVersions(c.req.param('identifier')));
});

registry.get('/tools/:identifier', async (c) => {
  return c.json(await getPublicTool(c.req.param('identifier')));
});

export { registry as registryRoutes };
