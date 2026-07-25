import { ValidationError } from './errors.js';

export function normalizeOptionalLogoUrl(value: string | undefined | null) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > 2048) {
    throw new ValidationError('logoUrl must be at most 2048 characters');
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new ValidationError('logoUrl must be a valid URL');
  }

  if (url.protocol !== 'https:') {
    throw new ValidationError('logoUrl must use HTTPS');
  }
  if (url.username || url.password) {
    throw new ValidationError('logoUrl must not contain credentials');
  }

  return url.toString();
}
