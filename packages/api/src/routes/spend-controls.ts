import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import { ValidationError } from '../lib/errors.js';
import { getPublicTool } from '../services/registry.js';
import {
  deleteToolSpendControls,
  getOrCreateGlobalSpendControls,
  getSpendControlPreview,
  getToolSpendControls,
  updateGlobalSpendControls,
  updateToolSpendControls,
  type GlobalSpendControlUpdate,
  type ToolSpendControlUpdate,
} from '../services/spend-controls.js';

const controls = new Hono<{ Variables: { auth: AuthContext } }>();
const MONEY_PATTERN = /^\d+(?:\.\d{1,4})?$/;

function validateUsd(value: unknown, field: string, nullable = false) {
  if (value === undefined || (nullable && value === null)) return;
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value) || Number.parseFloat(value) < 0) {
    throw new ValidationError(`${field} must be a non-negative USD string with at most 4 decimals`);
  }
}

function validateRate(value: unknown, field: string, nullable = false) {
  if (value === undefined || (nullable && value === null)) return;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 1_000_000) {
    throw new ValidationError(`${field} must be an integer between 1 and 1000000`);
  }
}

controls.get('/', async (c) => {
  const { auth } = c.var;
  return c.json(await getOrCreateGlobalSpendControls(auth.userId));
});

controls.put('/', async (c) => {
  const { auth } = c.var;
  const body = await c.req.json<GlobalSpendControlUpdate>();
  validateUsd(body.maxPerCallUsd, 'maxPerCallUsd');
  validateUsd(body.dailyLimitUsd, 'dailyLimitUsd');
  validateUsd(body.monthlyLimitUsd, 'monthlyLimitUsd');
  validateRate(body.rateLimitPerMinute, 'rateLimitPerMinute');
  validateRate(body.rateLimitPerHour, 'rateLimitPerHour');
  return c.json(await updateGlobalSpendControls(auth.userId, body));
});

controls.get('/tools/:identifier', async (c) => {
  const { auth } = c.var;
  const tool = await getPublicTool(c.req.param('identifier'));
  const configured = await getToolSpendControls(auth.userId, tool.id);
  const preview = await getSpendControlPreview(auth.userId, tool.id, '0.0000');
  return c.json({ tool: { id: tool.id, slug: tool.slug, name: tool.name }, configured, preview });
});

controls.put('/tools/:identifier', async (c) => {
  const { auth } = c.var;
  const tool = await getPublicTool(c.req.param('identifier'));
  const body = await c.req.json<ToolSpendControlUpdate>();
  if (body.allowed !== undefined && typeof body.allowed !== 'boolean') {
    throw new ValidationError('allowed must be true or false');
  }
  validateUsd(body.maxPerCallUsd, 'maxPerCallUsd', true);
  validateUsd(body.dailyLimitUsd, 'dailyLimitUsd', true);
  validateUsd(body.monthlyLimitUsd, 'monthlyLimitUsd', true);
  validateRate(body.rateLimitPerMinute, 'rateLimitPerMinute', true);
  validateRate(body.rateLimitPerHour, 'rateLimitPerHour', true);
  const configured = await updateToolSpendControls(auth.userId, tool.id, body);
  return c.json({ tool: { id: tool.id, slug: tool.slug, name: tool.name }, configured });
});

controls.delete('/tools/:identifier', async (c) => {
  const { auth } = c.var;
  const tool = await getPublicTool(c.req.param('identifier'));
  await deleteToolSpendControls(auth.userId, tool.id);
  return c.json({ removed: true, tool: { id: tool.id, slug: tool.slug } });
});

export { controls as spendControlRoutes };
