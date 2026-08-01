import { describe, expect, it } from 'vitest';
import { ForbiddenError, ValidationError } from './errors.js';
import {
  assertCanDelegatePermissions,
  hasPermission,
  requiredPermission,
  validateRequestedPermissions,
} from './permissions.js';

describe('API permissions', () => {
  it('accepts exact and wildcard permissions', () => {
    expect(hasPermission(['wallet:read'], 'wallet:read')).toBe(true);
    expect(hasPermission(['*'], 'provider:write')).toBe(true);
    expect(hasPermission(['wallet:read'], 'wallet:fund')).toBe(false);
  });

  it('rejects unknown permission names', () => {
    expect(() => validateRequestedPermissions(['wallet:reed'])).toThrowError(ValidationError);
  });

  it('prevents a key from delegating permissions it does not hold', () => {
    expect(() => assertCanDelegatePermissions(['wallet:read'], ['wallet:fund'])).toThrowError(
      ForbiddenError,
    );
    expect(() => assertCanDelegatePermissions(['keys:write', 'wallet:read'], ['wallet:read'])).not.toThrow();
    expect(() => assertCanDelegatePermissions(['*'], ['*'])).not.toThrow();
  });

  it.each([
    ['GET', '/v1/auth/me', 'account:read'],
    ['POST', '/v1/auth/keys', 'keys:write'],
    ['GET', '/v1/wallet', 'wallet:read'],
    ['POST', '/v1/wallet/fund', 'wallet:fund'],
    ['GET', '/v1/products/mine', 'provider:read'],
    ['GET', '/v1/products/tool-id', 'registry:read'],
    ['POST', '/v1/products/tool-id/publish', 'tools:publish'],
    ['PUT', '/v1/products/tool-id/credentials/self', 'credentials:write'],
    ['POST', '/v1/tools/weather/call', 'tools:call'],
    ['GET', '/v1/executions/execution-id/result', 'history:read'],
    ['PUT', '/v1/spend-controls/tools/weather', 'spend:write'],
    ['GET', '/v1/providers/earnings/calls', 'provider:read'],
    ['POST', '/v1/provider-imports/import-id/test', 'provider:write'],
  ])('maps %s %s to %s', (method, path, permission) => {
    expect(requiredPermission(method, path)).toBe(permission);
  });

  it.each([
    ['GET', '/v1/auth/me'], ['POST', '/v1/auth/keys'],
    ['GET', '/v1/wallet'], ['GET', '/v1/wallet/ledger'], ['POST', '/v1/wallet/fund'],
    ['POST', '/v1/wallet/fund/checkout'], ['POST', '/v1/search'],
    ['GET', '/v1/products'], ['POST', '/v1/products'], ['GET', '/v1/products/mine'],
    ['GET', '/v1/products/product-id'], ['POST', '/v1/products/product-id/submit'],
    ['POST', '/v1/products/product-id/publish'],
    ['POST', '/v1/products/product-id/credentials/provider'],
    ['PUT', '/v1/products/product-id/credentials/provider'],
    ['PUT', '/v1/products/product-id/credentials/self'],
    ['DELETE', '/v1/products/product-id/credentials/self'],
    ['GET', '/v1/purchases'], ['POST', '/v1/purchases'], ['POST', '/v1/quotes'],
    ['GET', '/v1/executions'], ['GET', '/v1/executions/execution-id'],
    ['GET', '/v1/executions/execution-id/result'], ['POST', '/v1/tools'],
    ['POST', '/v1/tools/tool-slug/quote'], ['POST', '/v1/tools/tool-slug/call'],
    ['GET', '/v1/spend-controls'], ['PUT', '/v1/spend-controls'],
    ['GET', '/v1/spend-controls/tools/tool-slug'],
    ['PUT', '/v1/spend-controls/tools/tool-slug'],
    ['DELETE', '/v1/spend-controls/tools/tool-slug'],
    ['GET', '/v1/providers'], ['POST', '/v1/providers'],
    ['POST', '/v1/providers/origin-verifications'],
    ['POST', '/v1/providers/origin-verifications/verification-id/verify'],
    ['POST', '/v1/providers/stripe/connect'], ['GET', '/v1/providers/stripe/status'],
    ['POST', '/v1/providers/stripe/sync'], ['GET', '/v1/providers/stripe/dashboard'],
    ['GET', '/v1/providers/earnings'], ['GET', '/v1/providers/earnings/calls'],
    ['GET', '/v1/providers/payouts'], ['GET', '/v1/provider-imports'],
    ['POST', '/v1/provider-imports'], ['GET', '/v1/provider-imports/import-id'],
    ['POST', '/v1/provider-imports/import-id/review'],
    ['POST', '/v1/provider-imports/import-id/test'],
    ['POST', '/v1/provider-imports/import-id/publish'],
    ['PUT', '/v1/moderation/tools/tool-id'],
  ])('has an authorization policy for %s %s', (method, path) => {
    expect(requiredPermission(method, path)).not.toBeNull();
  });

  it('defaults unknown authenticated routes to no policy', () => {
    expect(requiredPermission('POST', '/v1/admin/surprise')).toBeNull();
  });
});
