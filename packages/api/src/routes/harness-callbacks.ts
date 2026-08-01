import { Hono } from 'hono';
import { ingestHarnessEvent } from '../services/harness-runs.js';

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

export { callbacks as harnessCallbackRoutes };
