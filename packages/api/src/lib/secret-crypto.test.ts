import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secret-crypto.js';

const originalSecret = process.env.SECRET_ENCRYPTION_SECRET;

describe('secret crypto', () => {
  beforeEach(() => {
    process.env.SECRET_ENCRYPTION_SECRET =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SECRET_ENCRYPTION_SECRET;
    } else {
      process.env.SECRET_ENCRYPTION_SECRET = originalSecret;
    }
  });

  it('round-trips encrypted secrets without exposing plaintext', () => {
    const ciphertext = encryptSecret('super-secret-token');

    expect(ciphertext).not.toContain('super-secret-token');
    expect(decryptSecret(ciphertext)).toBe('super-secret-token');
  });

  it('uses a random IV for each encryption', () => {
    const first = encryptSecret('same-value');
    const second = encryptSecret('same-value');

    expect(first).not.toBe(second);
  });
});
