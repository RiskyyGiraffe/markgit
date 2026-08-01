import { Hono } from 'hono';
import { ConflictError, ValidationError } from '../lib/errors.js';
import { manifestSkillConfig, skillExecutionConfig, validateSkillManifest } from '../lib/skill-manifest.js';
import type { AuthContext } from '../middleware/auth.js';
import { createProduct, getProductBySlug } from '../services/products.js';
import { getProviderByUserId } from '../services/providers.js';

const skills = new Hono<{ Variables: { auth: AuthContext } }>();

skills.post('/', async (c) => {
  const { auth } = c.var;
  const provider = await getProviderByUserId(auth.userId);
  if (!provider) throw new ValidationError('Register as a provider before publishing a skill');
  const manifest = validateSkillManifest(await c.req.json<unknown>());
  const existing = await getProductBySlug(manifest.slug);
  if (existing) {
    if (existing.kind !== 'skill') throw new ConflictError(`The slug "${manifest.slug}" belongs to another listing type`);
    if (existing.providerId !== provider.id) throw new ConflictError(`The skill slug "${manifest.slug}" is already in use`);
    return c.json({ skill: existing, created: false, next: existing.status === 'active' ? 'This skill is already active' : `Continue onboarding from its current ${existing.status} status` });
  }
  const skill = await createProduct({
    providerId: provider.id,
    kind: 'skill',
    name: manifest.name,
    slug: manifest.slug,
    logoUrl: manifest.logoUrl,
    description: manifest.description,
    category: manifest.category,
    tags: manifest.tags,
    executionConfig: skillExecutionConfig(manifest),
    skillConfig: manifestSkillConfig(manifest) as unknown as Record<string, unknown>,
    pricePerCallUsd: '0.0000',
  });
  return c.json({ skill, created: true, next: `Submit it for review with POST /v1/products/${skill.id}/submit` }, 201);
});

export { skills as skillRoutes };
