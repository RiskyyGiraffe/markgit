import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import type { AuthContext } from './auth.js';

export const sessionMiddleware = createMiddleware<{
  Variables: { auth: AuthContext; sessionId: string };
}>(async (c, next) => {
  const auth = c.get('auth');
  const existingSessionId = c.req.header('X-Tolty-Session');

  let sessionId: string;

  if (existingSessionId) {
    // Verify session exists and belongs to this user
    const [existing] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, existingSessionId))
      .limit(1);

    if (existing) {
      sessionId = existing.id;
      // Update last activity (fire-and-forget)
      db.update(sessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(sessions.id, sessionId))
        .then(() => {});
    } else {
      // Create new session if provided ID not found
      const [newSession] = await db
        .insert(sessions)
        .values({
          userId: auth.userId,
          apiKeyId: auth.apiKeyId,
        })
        .returning({ id: sessions.id });
      sessionId = newSession.id;
    }
  } else {
    // Auto-create a new session
    const [newSession] = await db
      .insert(sessions)
      .values({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
      })
      .returning({ id: sessions.id });
    sessionId = newSession.id;
  }

  c.set('sessionId', sessionId);
  c.header('X-Tolty-Session', sessionId);

  await next();
});
