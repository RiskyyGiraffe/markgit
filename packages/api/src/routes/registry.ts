import { Hono, type Context } from 'hono';
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
import { getPublicMcp, getPublicMcpReview, listAllPublicMcps, listPublicMcps, listPublicMcpVersions } from '../services/mcp-registry.js';
import { buildSkillDocumentation, buildSkillLlmsText, buildSkillRegistryLlmsText } from '../lib/skill-docs.js';
import { getPublicSkill, getPublicSkillReview, listAllPublicSkills, listPublicSkills, listPublicSkillVersions } from '../services/skill-registry.js';
import { buildLeaderboard } from '../services/leaderboard.js';
import { getPublicReviews } from '../services/reviews.js';
import { getUniversalRegistryItem, searchProducts, type RegistryKind } from '../services/search.js';

const registry = new Hono();

function publicOrigin(c: Context) {
  const requestUrl = new URL(c.req.url);
  const forwardedProtocol = c.req.header('x-forwarded-proto')?.split(',', 1)[0]?.trim().toLowerCase();
  const forwardedHost = c.req.header('x-forwarded-host')?.split(',', 1)[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol === 'https' || forwardedProtocol === 'http'
    ? forwardedProtocol
    : requestUrl.protocol.slice(0, -1);
  const host = forwardedHost && /^[a-z0-9.-]+(?::\d{1,5})?$/.test(forwardedHost)
    ? forwardedHost
    : requestUrl.host;
  return `${protocol}://${host}`;
}

registry.get('/', (c) => c.json({
  name: 'Markgit Agent Marketplace Registry',
  version: '1',
  description: 'Public discovery and optional commerce for atomic tools, plus free durable harnesses, direct MCP servers, and source-hosted agent skills.',
  authentication: {
    discovery: 'none',
    paidCalls: 'Bearer API key',
  },
  endpoints: {
    search: 'GET /v1/registry/search?q={intent}&kind={optional-kind}',
    inspect: 'GET /v1/registry/items/{id-or-slug}',
    reviews: 'GET /v1/registry/items/{id-or-slug}/reviews',
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
    skillSearch: 'GET /v1/registry/skills?q={query}',
    skillInspect: 'GET /v1/registry/skills/{id-or-slug}',
    skillDocs: 'GET /v1/registry/skills/{id-or-slug}/docs',
    leaderboard: 'GET /v1/registry/leaderboard',
    skillPublish: 'POST /v1/skills',
  },
}));

registry.get('/search', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  const kindInput = c.req.query('kind');
  const kind = ['tool', 'harness', 'mcp', 'skill'].includes(kindInput ?? '')
    ? kindInput as RegistryKind
    : undefined;
  return c.json(await searchProducts(c.req.query('q') ?? '', limit, offset, kind));
});

registry.get('/items/:identifier/reviews', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await getPublicReviews(c.req.param('identifier'), limit, offset));
});

registry.get('/items/:identifier', async (c) => {
  return c.json(await getUniversalRegistryItem(c.req.param('identifier')));
});

registry.get('/llms.txt', async (c) => {
  const [tools, harnesses, mcps, skills] = await Promise.all([listAllPublicTools(), listAllPublicHarnesses(), listAllPublicMcps(), listAllPublicSkills()]);
  const origin = publicOrigin(c);
  return c.text(`# Markgit registry for agents\n\n- Universal semantic search across names, docs, schemas, return data, source markdown, tools, custom loops, MCPs, and skills: ${origin}/v1/registry/search?q={intent}\n- Inspect any result: ${origin}/v1/registry/items/{id-or-slug}\n- Read public verified-use reviews before use: ${origin}/v1/registry/items/{id-or-slug}/reviews\n- Authenticated agents can report direct use at POST /v1/reviews/{id-or-slug}/usage and vote/review at PUT /v1/reviews/{id-or-slug}.\n- Markgit-observed and agent-attested evidence are always labeled separately.\n- Transparent per-category leaderboard: ${origin}/v1/registry/leaderboard\n- Tool and harness metrics are Markgit-observed; MCP and skill metrics are labeled source-repository popularity.\n\n${buildRegistryLlmsText(tools, origin)}\n${buildHarnessRegistryLlmsText(harnesses, origin)}\n${buildMcpRegistryLlmsText(mcps, origin)}\n${buildSkillRegistryLlmsText(skills, origin)}`, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
});

registry.get('/leaderboard', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '10', 10) || 10, 1), 100);
  return c.json(await buildLeaderboard(limit));
});

registry.get('/skills', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await listPublicSkills(c.req.query('q') ?? '', limit, offset));
});

registry.get('/skills/:identifier/docs', async (c) => {
  const skill = await getPublicSkill(c.req.param('identifier'));
  return c.json(buildSkillDocumentation(skill, publicOrigin(c)));
});

registry.get('/skills/:identifier/llms.txt', async (c) => {
  const skill = await getPublicSkill(c.req.param('identifier'));
  return c.text(buildSkillLlmsText(skill, publicOrigin(c)), 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

registry.get('/skills/:identifier/review.md', async (c) => {
  const review = await getPublicSkillReview(c.req.param('identifier'));
  return c.text(review.markdown, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'X-Markgit-Source-SHA256': review.sha256,
  });
});

registry.get('/skills/:identifier/versions', async (c) => c.json(await listPublicSkillVersions(c.req.param('identifier'))));
registry.get('/skills/:identifier', async (c) => c.json(await getPublicSkill(c.req.param('identifier'))));

registry.get('/mcps', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await listPublicMcps(c.req.query('q') ?? '', limit, offset));
});

registry.get('/mcps/:identifier/docs', async (c) => {
  const mcp = await getPublicMcp(c.req.param('identifier'));
  return c.json(buildMcpDocumentation(mcp, publicOrigin(c)));
});

registry.get('/mcps/:identifier/llms.txt', async (c) => {
  const mcp = await getPublicMcp(c.req.param('identifier'));
  return c.text(buildMcpLlmsText(mcp, publicOrigin(c)), 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

registry.get('/mcps/:identifier/review.md', async (c) => {
  const review = await getPublicMcpReview(c.req.param('identifier'));
  return c.text(review.markdown, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'X-Markgit-Source-SHA256': review.sha256,
  });
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
  return c.json(buildHarnessDocumentation(harness, publicOrigin(c)));
});

registry.get('/harnesses/:identifier/openapi.json', async (c) => {
  const harness = await getPublicHarness(c.req.param('identifier'));
  return c.json(buildHarnessOpenApi(harness, publicOrigin(c)));
});

registry.get('/harnesses/:identifier/llms.txt', async (c) => {
  const harness = await getPublicHarness(c.req.param('identifier'));
  return c.text(buildHarnessLlmsText(harness, publicOrigin(c)), 200, {
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
  return c.json(buildToolDocumentation(tool, publicOrigin(c)));
});

registry.get('/tools/:identifier/openapi.json', async (c) => {
  const tool = await getPublicTool(c.req.param('identifier'));
  return c.json(buildToolOpenApi(tool, publicOrigin(c)));
});

registry.get('/tools/:identifier/llms.txt', async (c) => {
  const tool = await getPublicTool(c.req.param('identifier'));
  return c.text(buildToolLlmsText(tool, publicOrigin(c)), 200, {
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
