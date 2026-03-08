import { ForbiddenError, ValidationError } from './errors.js';

function parseUsd(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`Invalid USD amount: ${value}`);
  }

  return parsed;
}

export function addUsd(...values: string[]): string {
  return values
    .reduce((total, value) => total + parseUsd(value), 0)
    .toFixed(4);
}

export function ensureResourceOwnership(
  resourceName: string,
  ownerUserId: string,
  userId: string,
) {
  if (ownerUserId !== userId) {
    throw new ForbiddenError(`${resourceName} does not belong to the authenticated user`);
  }
}

export function ensureBudgetWithinLimit(
  limitUsd: string | null,
  usedUsd: string,
  requestedUsd: string,
) {
  if (!limitUsd) return;

  const limit = parseUsd(limitUsd);
  const used = parseUsd(usedUsd);
  const requested = parseUsd(requestedUsd);

  if (used + requested > limit) {
    throw new ForbiddenError('API key budget limit exceeded');
  }
}

export function ensureHoldIsActive(status: string) {
  if (status !== 'held') {
    throw new ValidationError(`Hold is already ${status}`);
  }
}

export function canReuseSession(
  sessionUserId: string,
  sessionApiKeyId: string,
  authUserId: string,
  authApiKeyId: string,
) {
  return sessionUserId === authUserId && sessionApiKeyId === authApiKeyId;
}
