import { Hono } from 'hono';
import { getPublicTool, listPublicTools } from '../services/registry.js';

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
    call: 'POST /v1/tools/{id-or-slug}/call',
  },
}));

registry.get('/tools', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await listPublicTools(c.req.query('q') ?? '', limit, offset));
});

registry.get('/tools/:identifier', async (c) => {
  return c.json(await getPublicTool(c.req.param('identifier')));
});

export { registry as registryRoutes };
