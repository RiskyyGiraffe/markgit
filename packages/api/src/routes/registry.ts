import { Hono } from 'hono';
import { getPublicTool, listAllPublicTools, listPublicTools } from '../services/registry.js';
import {
  buildRegistryLlmsText,
  buildToolDocumentation,
  buildToolLlmsText,
  buildToolOpenApi,
} from '../lib/tool-docs.js';

const registry = new Hono();

registry.get('/', (c) => c.json({
  name: 'Markgit Tool Registry',
  version: '1',
  description: 'Public discovery for provider-hosted tools with optional metered commerce.',
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
    quote: 'POST /v1/tools/{id-or-slug}/quote',
    call: 'POST /v1/tools/{id-or-slug}/call',
  },
}));

registry.get('/llms.txt', async (c) => {
  const tools = await listAllPublicTools();
  const origin = new URL(c.req.url).origin;
  return c.text(buildRegistryLlmsText(tools, origin), 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
});

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

registry.get('/tools/:identifier', async (c) => {
  return c.json(await getPublicTool(c.req.param('identifier')));
});

export { registry as registryRoutes };
