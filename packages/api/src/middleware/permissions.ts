import { createMiddleware } from 'hono/factory';
import { ForbiddenError, PermissionError } from '../lib/errors.js';
import { hasPermission, requiredPermission } from '../lib/permissions.js';
import type { AuthContext } from './auth.js';

export const permissionMiddleware = createMiddleware<{
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  const required = requiredPermission(c.req.method, c.req.path);
  if (!required) {
    throw new ForbiddenError('This API route has no authorization policy');
  }

  if (!hasPermission(c.var.auth.permissions, required)) {
    throw new PermissionError(required);
  }

  await next();
});
