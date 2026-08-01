import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { moderationEvents, products } from '../db/schema.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';

function adminUserIds(): Set<string> {
  return new Set(
    (process.env.MARKGIT_ADMIN_USER_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function assertModerator(userId: string) {
  if (!adminUserIds().has(userId)) throw new ForbiddenError('Moderator access is required');
}

export async function moderateProduct(
  actorUserId: string,
  productId: string,
  nextStatus: 'clear' | 'flagged' | 'quarantined',
  reason: string,
) {
  assertModerator(actorUserId);
  if (!reason.trim() || reason.trim().length > 2_000) {
    throw new ValidationError('reason is required and must be at most 2000 characters');
  }

  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ moderationStatus: products.moderationStatus })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product) throw new NotFoundError('Product');

    const [updated] = await tx
      .update(products)
      .set({ moderationStatus: nextStatus, updatedAt: new Date() })
      .where(eq(products.id, productId))
      .returning();
    const [event] = await tx
      .insert(moderationEvents)
      .values({
        productId,
        actorUserId,
        previousStatus: product.moderationStatus,
        nextStatus,
        reason: reason.trim(),
      })
      .returning();
    return { product: updated, event };
  });
}
