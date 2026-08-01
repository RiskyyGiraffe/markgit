import { Hono } from 'hono';
import type { AuthContext } from '../middleware/auth.js';
import {
  listQuicklist,
  removeQuicklistEntry,
  upsertQuicklistEntry,
  validateAuthorizationMode,
} from '../services/quicklist.js';

const quicklist = new Hono<{ Variables: { auth: AuthContext } }>();

quicklist.get('/', async (c) => c.json(await listQuicklist(c.var.auth.userId)));

quicklist.put('/:identifier', async (c) => {
  const body = await c.req.json<{ authorizationMode?: unknown }>().catch(() => ({ authorizationMode: undefined }));
  const authorizationMode = validateAuthorizationMode(body.authorizationMode ?? 'ask_paid');
  return c.json(await upsertQuicklistEntry(c.var.auth.userId, c.req.param('identifier'), authorizationMode));
});

quicklist.delete('/:identifier', async (c) => {
  return c.json(await removeQuicklistEntry(c.var.auth.userId, c.req.param('identifier')));
});

export { quicklist as quicklistRoutes };
