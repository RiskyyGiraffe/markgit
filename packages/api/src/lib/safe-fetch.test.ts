import { describe, expect, it } from 'vitest';
import {
  assertSafeRequestHeader,
  isPublicIpAddress,
  resolveAllowedAddress,
  validateOutboundUrl,
} from './safe-fetch.js';

describe('safe outbound HTTP', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.10',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
  ])('classifies %s as non-public', (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it('allows globally routable addresses', () => {
    expect(isPublicIpAddress('8.8.8.8')).toBe(true);
    expect(isPublicIpAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('requires HTTPS and rejects URL credentials', () => {
    expect(() => validateOutboundUrl('http://example.com')).toThrow('must use HTTPS');
    expect(() => validateOutboundUrl('https://user:pass@example.com')).toThrow('embedded credentials');
  });

  it('allows local HTTP only when explicitly enabled outside production', () => {
    expect(() => validateOutboundUrl('http://127.0.0.1', {
      allowPrivate: true,
      allowInsecureHttp: true,
    })).not.toThrow();
  });

  it('rejects private literal and DNS-resolved destinations', async () => {
    expect(() => validateOutboundUrl('https://127.0.0.1')).toThrow('private or reserved');
    await expect(
      resolveAllowedAddress('metadata.invalid', false, async () => [
        { address: '169.254.169.254', family: 4 },
      ]),
    ).rejects.toThrow('private or reserved');
  });

  it('selects and pins a public DNS result', async () => {
    await expect(
      resolveAllowedAddress('api.example.com', false, async () => [
        { address: '10.0.0.1', family: 4 },
        { address: '93.184.216.34', family: 4 },
      ]),
    ).resolves.toEqual({ address: '93.184.216.34', family: 4 });
  });

  it('blocks hop-by-hop and routing headers', () => {
    expect(() => assertSafeRequestHeader('Host')).toThrow('not allowed');
    expect(() => assertSafeRequestHeader('X-Forwarded-For')).toThrow('not allowed');
    expect(() => assertSafeRequestHeader('X-Custom-Header')).not.toThrow();
  });
});
