import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';
import { moderateProduct } from '../services/moderation.js';

const moderation = new Hono<{ Variables: { auth: AuthContext } }>();

moderation.put('/tools/:id', async (c) => {
  const body = await c.req.json<{ status?: string; reason?: string }>();
  if (!body.status || !['clear', 'flagged', 'quarantined'].includes(body.status)) {
    throw new ValidationError('status must be clear, flagged, or quarantined');
  }
  if (!body.reason) throw new ValidationError('reason is required');
  return c.json(await moderateProduct(
    c.var.auth.userId,
    c.req.param('id'),
    body.status as 'clear' | 'flagged' | 'quarantined',
    body.reason,
  ));
});

export { moderation as moderationRoutes };
