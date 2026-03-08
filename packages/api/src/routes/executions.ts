import { Hono } from 'hono';
import { getExecution, getExecutionResult, listExecutions } from '../services/executions.js';
import type { AuthContext } from '../middleware/auth.js';

const executions = new Hono<{ Variables: { auth: AuthContext } }>();

executions.get('/', async (c) => {
  const { auth: ctx } = c.var;
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const result = await listExecutions(ctx.userId, limit, offset);
  return c.json(result);
});

executions.get('/:id', async (c) => {
  const { auth: ctx } = c.var;
  const execution = await getExecution(ctx.userId, c.req.param('id'));
  return c.json(execution);
});

executions.get('/:id/result', async (c) => {
  const { auth: ctx } = c.var;
  const result = await getExecutionResult(ctx.userId, c.req.param('id'));
  return c.json(result);
});

export { executions as executionRoutes };
