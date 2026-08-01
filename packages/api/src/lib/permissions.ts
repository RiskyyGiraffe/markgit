import { ForbiddenError, ValidationError } from './errors.js';

export const API_PERMISSIONS = [
  'account:read',
  'keys:write',
  'registry:read',
  'tools:call',
  'tools:publish',
  'harnesses:run',
  'harnesses:monitor',
  'harnesses:publish',
  'wallet:read',
  'wallet:fund',
  'history:read',
  'spend:read',
  'spend:write',
  'provider:read',
  'provider:write',
  'credentials:write',
  'moderation:write',
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];
export type GrantedPermission = ApiPermission | '*';

export const CLI_PERMISSIONS: ApiPermission[] = [
  'account:read',
  'registry:read',
  'tools:call',
  'tools:publish',
  'harnesses:run',
  'harnesses:monitor',
  'harnesses:publish',
  'wallet:read',
  'wallet:fund',
  'history:read',
  'spend:read',
  'spend:write',
  'provider:read',
  'provider:write',
  'credentials:write',
];

const knownPermissions = new Set<string>(API_PERMISSIONS);

export function hasPermission(granted: readonly string[], required: ApiPermission): boolean {
  return granted.includes('*') || granted.includes(required);
}

export function validateRequestedPermissions(input: unknown): ApiPermission[] | ['*'] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.some((permission) => typeof permission !== 'string')) {
    throw new ValidationError('permissions must be an array of permission names');
  }

  const permissions = [...new Set(input as string[])];
  const invalid = permissions.filter(
    (permission) => permission !== '*' && !knownPermissions.has(permission),
  );
  if (invalid.length > 0) {
    throw new ValidationError(`Unknown permissions: ${invalid.join(', ')}`);
  }
  if (permissions.includes('*') && permissions.length > 1) {
    throw new ValidationError('Wildcard permission must be granted by itself');
  }

  return permissions as ApiPermission[] | ['*'];
}

export function assertCanDelegatePermissions(
  callerPermissions: readonly string[],
  requestedPermissions: readonly string[],
): void {
  if (callerPermissions.includes('*')) return;

  const elevated = requestedPermissions.filter(
    (permission) => permission === '*' || !callerPermissions.includes(permission),
  );
  if (elevated.length > 0) {
    throw new ForbiddenError(`Cannot grant permissions the current key does not have: ${elevated.join(', ')}`);
  }
}

function normalizedPath(path: string): string {
  const withoutQuery = path.split('?', 1)[0];
  const withoutVersion = withoutQuery.replace(/^\/v1(?=\/|$)/, '');
  return withoutVersion === '' ? '/' : withoutVersion.replace(/\/$/, '') || '/';
}

export function requiredPermission(method: string, rawPath: string): ApiPermission | null {
  const verb = method.toUpperCase();
  const path = normalizedPath(rawPath);

  if (verb === 'GET' && path === '/auth/me') return 'account:read';
  if (verb === 'POST' && path === '/auth/keys') return 'keys:write';

  if (verb === 'GET' && (path === '/wallet' || path === '/wallet/ledger')) return 'wallet:read';
  if (verb === 'POST' && (path === '/wallet/fund' || path === '/wallet/fund/checkout')) return 'wallet:fund';

  if (verb === 'POST' && path === '/search') return 'registry:read';

  if (verb === 'GET' && path === '/products/mine') return 'provider:read';
  if (verb === 'GET' && (path === '/products' || /^\/products\/[^/]+$/.test(path))) return 'registry:read';
  if (
    ['POST', 'PUT', 'DELETE'].includes(verb) &&
    /^\/products\/[^/]+\/credentials\/(provider|self)$/.test(path)
  ) return 'credentials:write';
  if (
    verb === 'POST' &&
    (path === '/products' || /^\/products\/[^/]+\/(submit|publish)$/.test(path))
  ) return 'tools:publish';

  if (verb === 'GET' && path === '/purchases') return 'history:read';
  if (verb === 'POST' && (path === '/purchases' || path === '/quotes')) return 'tools:call';

  if (verb === 'GET' && /^\/executions(?:\/[^/]+(?:\/result)?)?$/.test(path)) return 'history:read';

  if (verb === 'POST' && path === '/tools') return 'tools:publish';
  if (verb === 'POST' && /^\/tools\/[^/]+\/(quote|call)$/.test(path)) return 'tools:call';

  if (verb === 'POST' && path === '/harnesses') return 'harnesses:publish';
  if (verb === 'POST' && /^\/harnesses\/[^/]+\/runs$/.test(path)) return 'harnesses:run';
  if (verb === 'GET' && /^\/harness-runs(?:\/[^/]+(?:\/events)?)?$/.test(path)) return 'harnesses:monitor';
  if (verb === 'POST' && /^\/harness-runs\/[^/]+\/cancel$/.test(path)) return 'harnesses:run';

  if (verb === 'GET' && /^\/spend-controls(?:\/tools\/[^/]+)?$/.test(path)) return 'spend:read';
  if (
    ['PUT', 'DELETE'].includes(verb) &&
    /^\/spend-controls(?:\/tools\/[^/]+)?$/.test(path)
  ) return 'spend:write';

  if (verb === 'GET' && path === '/providers') return 'provider:read';
  if (verb === 'POST' && path === '/providers') return 'provider:write';
  if (verb === 'POST' && /^\/providers\/origin-verifications(?:\/[^/]+\/verify)?$/.test(path)) {
    return 'provider:write';
  }
  if (verb === 'GET' && /^\/providers\/(stripe\/(status|dashboard)|earnings(?:\/calls)?|payouts)$/.test(path)) {
    return 'provider:read';
  }
  if (verb === 'POST' && /^\/providers\/stripe\/(connect|sync)$/.test(path)) return 'provider:write';

  if (verb === 'GET' && /^\/provider-imports(?:\/[^/]+)?$/.test(path)) return 'provider:read';
  if (
    verb === 'POST' &&
    (path === '/provider-imports' || /^\/provider-imports\/[^/]+\/(review|test|publish)$/.test(path))
  ) return 'provider:write';

  if (verb === 'PUT' && /^\/moderation\/tools\/[^/]+$/.test(path)) return 'moderation:write';

  return null;
}
