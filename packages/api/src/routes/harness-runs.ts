import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import {
  cancelHarnessRun,
  getHarnessRun,
  listHarnessRunEvents,
  listHarnessRuns,
} from '../services/harness-runs.js';

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
runs.get('/:runId', async (c) => c.json(await getHarnessRun(c.var.auth.userId, c.req.param('runId'))));

export { runs as harnessRunRoutes };
