import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import {
  cancelHarnessRun,
  getHarnessRun,
  listHarnessRunEvents,
  listHarnessRuns,
} from '../services/harness-runs.js';
import { consolidateHarnessRunFeedback, recordHarnessRunFeedback } from '../services/reviews.js';
import { ValidationError } from '../lib/errors.js';

const runs = new Hono<{ Variables: { auth: AuthContext } }>();

runs.get('/', async (c) => {
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);
  return c.json(await listHarnessRuns(c.var.auth.userId, limit, offset));
});

runs.get('/:runId/events', async (c) => {
  const after = Math.max(Number.parseInt(c.req.query('after') ?? '0', 10) || 0, 0);
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') ?? '200', 10) || 200, 1), 500);
  return c.json(await listHarnessRunEvents(c.var.auth.userId, c.req.param('runId'), after, limit));
});

runs.post('/:runId/cancel', async (c) => c.json(await cancelHarnessRun(c.var.auth.userId, c.req.param('runId'))));
runs.post('/:runId/feedback', async (c) => {
  const body = await c.req.json<{ clientEventId?: unknown; sentiment?: unknown; message?: unknown }>();
  if (typeof body.clientEventId !== 'string' || typeof body.sentiment !== 'string' || typeof body.message !== 'string') {
    throw new ValidationError('clientEventId, sentiment, and message are required strings');
  }
  return c.json(await recordHarnessRunFeedback({
    userId: c.var.auth.userId, apiKeyId: c.var.auth.apiKeyId, runId: c.req.param('runId'),
    clientEventId: body.clientEventId, sentiment: body.sentiment, message: body.message,
  }), 201);
});
runs.post('/:runId/consolidate-review', async (c) => {
  const body = await c.req.json<{ agentName?: unknown; finalHelpful?: unknown; title?: unknown; finalSummary?: unknown }>();
  if (typeof body.agentName !== 'string') throw new ValidationError('agentName is required');
  if (body.finalHelpful !== undefined && typeof body.finalHelpful !== 'boolean') throw new ValidationError('finalHelpful must be a boolean');
  if (body.title !== undefined && typeof body.title !== 'string') throw new ValidationError('title must be a string');
  if (body.finalSummary !== undefined && typeof body.finalSummary !== 'string') throw new ValidationError('finalSummary must be a string');
  return c.json(await consolidateHarnessRunFeedback({
    userId: c.var.auth.userId, apiKeyId: c.var.auth.apiKeyId, runId: c.req.param('runId'),
    agentName: body.agentName, finalHelpful: body.finalHelpful, title: body.title, finalSummary: body.finalSummary,
  }));
});
runs.get('/:runId', async (c) => c.json(await getHarnessRun(c.var.auth.userId, c.req.param('runId'))));

export { runs as harnessRunRoutes };
