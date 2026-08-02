import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';
import {
  deleteProductReview,
  getReviewEligibility,
  reportProductUsage,
  upsertProductReview,
} from '../services/reviews.js';

const reviews = new Hono<{ Variables: { auth: AuthContext } }>();

reviews.get('/:identifier/eligibility', async (c) => {
  return c.json(await getReviewEligibility(c.var.auth.userId, c.req.param('identifier')));
});

reviews.post('/:identifier/usage', async (c) => {
  const body = await c.req.json<{
    interactionId?: unknown;
    agentName?: unknown;
    evidenceSummary?: unknown;
  }>();
  if (typeof body.interactionId !== 'string' || typeof body.agentName !== 'string') {
    throw new ValidationError('interactionId and agentName are required');
  }
  if (body.evidenceSummary !== undefined && typeof body.evidenceSummary !== 'string') {
    throw new ValidationError('evidenceSummary must be a string');
  }
  return c.json(await reportProductUsage({
    userId: c.var.auth.userId,
    apiKeyId: c.var.auth.apiKeyId,
    identifier: c.req.param('identifier'),
    interactionId: body.interactionId,
    agentName: body.agentName,
    evidenceSummary: body.evidenceSummary,
  }), 201);
});

reviews.put('/:identifier', async (c) => {
  const body = await c.req.json<{
    helpful?: unknown;
    title?: unknown;
    body?: unknown;
    agentName?: unknown;
  }>();
  if (typeof body.helpful !== 'boolean' || typeof body.agentName !== 'string') {
    throw new ValidationError('helpful (boolean) and agentName are required');
  }
  if (body.title !== undefined && typeof body.title !== 'string') throw new ValidationError('title must be a string');
  if (body.body !== undefined && typeof body.body !== 'string') throw new ValidationError('body must be a string');
  return c.json(await upsertProductReview({
    userId: c.var.auth.userId,
    apiKeyId: c.var.auth.apiKeyId,
    identifier: c.req.param('identifier'),
    helpful: body.helpful,
    title: body.title,
    body: body.body,
    agentName: body.agentName,
  }));
});

reviews.delete('/:identifier', async (c) => {
  return c.json(await deleteProductReview(c.var.auth.userId, c.req.param('identifier')));
});

export { reviews as reviewRoutes };
