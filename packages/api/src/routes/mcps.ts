import { Hono } from 'hono';
import { ConflictError, ValidationError } from '../lib/errors.js';
import { manifestMcpCapabilities, manifestMcpConfig, mcpExecutionConfig, validateMcpManifest } from '../lib/mcp-manifest.js';
import type { AuthContext } from '../middleware/auth.js';
import { createProduct, getProductBySlug } from '../services/products.js';
import { getProviderByUserId } from '../services/providers.js';

const mcps = new Hono<{ Variables: { auth: AuthContext } }>();

mcps.post('/', async (c) => {
  const { auth } = c.var;
  const provider = await getProviderByUserId(auth.userId);
  if (!provider) throw new ValidationError('Register as a provider before publishing an MCP server');
  const manifest = validateMcpManifest(await c.req.json<unknown>());
  const existing = await getProductBySlug(manifest.slug);
  if (existing) {
    if (existing.kind !== 'mcp') throw new ConflictError(`The slug "${manifest.slug}" belongs to another listing type`);
    if (existing.providerId !== provider.id) throw new ConflictError(`The MCP slug "${manifest.slug}" is already in use`);
    return c.json({
      mcp: existing,
      created: false,
      next: existing.status === 'active' ? 'This MCP server is already active' : `Continue onboarding from its current ${existing.status} status`,
    });
  }
  const mcp = await createProduct({
    providerId: provider.id,
    kind: 'mcp',
    name: manifest.name,
    slug: manifest.slug,
    logoUrl: manifest.logoUrl,
    description: manifest.description,
    category: manifest.category,
    tags: manifest.tags,
    executionConfig: mcpExecutionConfig(manifest),
    mcpConfig: manifestMcpConfig(manifest) as unknown as Record<string, unknown>,
    capabilities: manifestMcpCapabilities(manifest),
    pricePerCallUsd: '0.0000',
  });
  return c.json({
    mcp,
    created: true,
    next: `Submit it for review with POST /v1/products/${mcp.id}/submit`,
  }, 201);
});

export { mcps as mcpRoutes };
