import { Hono } from 'hono';
import { ValidationError } from '../lib/errors.js';
import { callHarnessTool, ingestHarnessEvent } from '../services/harness-runs.js';

const callbacks = new Hono();

callbacks.post('/:runId/events', async (c) => {
  const authorization = c.req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const event = await c.req.json<{
    type: string;
    message?: string;
    data?: Record<string, unknown>;
  }>();
  const created = await ingestHarnessEvent(c.req.param('runId'), token, event);
  return c.json({ accepted: true, event: created }, 202);
});

callbacks.post('/:runId/tools/:slug/call', async (c) => {
  const authorization = c.req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const requestId = c.req.header('Idempotency-Key');
  if (!requestId || requestId.length > 255) throw new ValidationError('A valid Idempotency-Key header is required');
  const body: { input?: Record<string, unknown> } = await c.req
    .json<{ input?: Record<string, unknown> }>()
    .catch(() => ({}));
  if (body.input !== undefined && (!body.input || typeof body.input !== 'object' || Array.isArray(body.input))) {
    throw new ValidationError('input must be a JSON object');
  }
  const result = await callHarnessTool(
    c.req.param('runId'),
    token,
    c.req.param('slug'),
    requestId,
    body.input ?? {},
  );
  return c.json({ result });
});

export { callbacks as harnessCallbackRoutes };
