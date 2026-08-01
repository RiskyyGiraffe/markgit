import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, request, type Dispatcher } from 'undici';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_MAX_REDIRECTS = 3;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);

export type RedirectPolicy = 'none' | 'same-origin' | 'public';

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  redirectPolicy?: RedirectPolicy;
  allowPrivate?: boolean;
  allowInsecureHttp?: boolean;
}

export interface SafeFetchResponse {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  url: string;
}

type ResolvedAddress = { address: string; family: 4 | 6 };
type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const blockedRequestHeaders = new Set([
  'connection',
  'content-length',
  'forwarded',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
]);

function developmentFlag(name: string): boolean {
  return process.env.NODE_ENV !== 'production' && process.env[name] === 'true';
}

function developmentOption(value: boolean | undefined, environmentName: string): boolean {
  return process.env.NODE_ENV !== 'production' && (value ?? developmentFlag(environmentName));
}

export function isPublicIpAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

export function assertSafeRequestHeader(name: string): void {
  const normalized = name.trim().toLowerCase();
  if (!/^[!#$%&'*+\-.^_`|~0-9a-z]+$/.test(normalized)) {
    throw new Error(`Unsafe upstream request header: ${name}`);
  }
  if (
    blockedRequestHeaders.has(normalized) ||
    normalized.startsWith('cf-') ||
    normalized.startsWith('sec-')
  ) {
    throw new Error(`Upstream request header is not allowed: ${name}`);
  }
}

export function validateOutboundUrl(
  rawUrl: string,
  options: Pick<SafeFetchOptions, 'allowPrivate' | 'allowInsecureHttp'> = {},
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Upstream URL is invalid');
  }

  const allowInsecureHttp = developmentOption(
    options.allowInsecureHttp,
    'MARKGIT_ALLOW_INSECURE_HTTP',
  );
  if (url.protocol !== 'https:' && !(allowInsecureHttp && url.protocol === 'http:')) {
    throw new Error('Upstream URL must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Upstream URL must not contain embedded credentials');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const allowPrivate = developmentOption(options.allowPrivate, 'MARKGIT_ALLOW_PRIVATE_OUTBOUND');
  if (isIP(hostname) && !allowPrivate && !isPublicIpAddress(hostname)) {
    throw new Error('Upstream URL resolves to a private or reserved address');
  }

  return url;
}

async function defaultResolver(hostname: string): Promise<ResolvedAddress[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results
    .filter((result): result is ResolvedAddress => result.family === 4 || result.family === 6)
    .map(({ address, family }) => ({ address, family }));
}

export async function resolveAllowedAddress(
  hostname: string,
  allowPrivate = false,
  resolver: AddressResolver = defaultResolver,
): Promise<ResolvedAddress> {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(normalizedHostname);
  const addresses = literalFamily
    ? [{ address: normalizedHostname, family: literalFamily as 4 | 6 }]
    : await resolver(normalizedHostname);

  const allowed = addresses.find(({ address }) => allowPrivate || isPublicIpAddress(address));
  if (!allowed) {
    throw new Error('Upstream URL resolves to a private or reserved address');
  }
  return allowed;
}

function normalizeResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? value.join(', ') : value]),
  );
}

async function readLimitedBody(
  body: AsyncIterable<Uint8Array> & { destroy?: (error?: Error) => void },
  headers: Record<string, string>,
  maxBytes: number,
): Promise<string> {
  const declaredLength = Number(headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    const error = new Error(`Upstream response exceeds the ${maxBytes} byte limit`);
    body.destroy?.(error);
    throw error;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) {
      const error = new Error(`Upstream response exceeds the ${maxBytes} byte limit`);
      body.destroy?.(error);
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function nextRedirectUrl(currentUrl: URL, location: string, policy: RedirectPolicy): URL {
  if (policy === 'none') throw new Error('Upstream redirects are not allowed');
  const next = new URL(location, currentUrl);
  if (policy === 'same-origin' && next.origin !== currentUrl.origin) {
    throw new Error('Upstream redirect changed origin');
  }
  return next;
}

function redirectMethod(status: number, method: Dispatcher.HttpMethod): Dispatcher.HttpMethod {
  if (status === 303 || ((status === 301 || status === 302) && method === 'POST')) return 'GET';
  return method;
}

export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const allowPrivate = developmentOption(options.allowPrivate, 'MARKGIT_ALLOW_PRIVATE_OUTBOUND');
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1), 60_000);
  const maxResponseBytes = Math.min(
    Math.max(options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES, 1),
    5_000_000,
  );
  const maxRedirects = Math.min(Math.max(options.maxRedirects ?? DEFAULT_MAX_REDIRECTS, 0), 5);
  const redirectPolicy = options.redirectPolicy ?? 'none';
  const headers = { ...(options.headers ?? {}) };
  Object.keys(headers).forEach(assertSafeRequestHeader);

  let url = validateOutboundUrl(rawUrl, options);
  let method = (options.method ?? 'GET').toUpperCase() as Dispatcher.HttpMethod;
  if (!ALLOWED_METHODS.has(method)) throw new Error(`Upstream HTTP method is not allowed: ${method}`);
  let body = options.body;

  for (let redirectCount = 0; ; redirectCount += 1) {
    const resolved = await resolveAllowedAddress(url.hostname, allowPrivate);
    const dispatcher = new Agent({
      connect: {
        lookup: ((
          _hostname: string,
          lookupOptions: { all?: boolean },
          callback: (error: Error | null, address: unknown, family?: number) => void,
        ) => {
          if (lookupOptions?.all) {
            callback(null, [resolved]);
          } else {
            callback(null, resolved.address, resolved.family);
          }
        }) as any,
      },
    });

    try {
      const response = await request(url, {
        dispatcher,
        method,
        headers,
        body,
        maxRedirections: 0,
        signal: AbortSignal.timeout(timeoutMs),
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      });
      const responseHeaders = normalizeResponseHeaders(response.headers);
      const isRedirect = [301, 302, 303, 307, 308].includes(response.statusCode);
      const location = responseHeaders.location;

      if (isRedirect && location) {
        // Consume the small redirect body before releasing the connection.
        await readLimitedBody(response.body, responseHeaders, Math.min(maxResponseBytes, 16_384));
        if (redirectCount >= maxRedirects) throw new Error('Upstream returned too many redirects');
        const next = nextRedirectUrl(url, location, redirectPolicy);
        url = validateOutboundUrl(next.toString(), options);
        const nextMethod = redirectMethod(response.statusCode, method);
        if (nextMethod === 'GET' && method !== 'GET') body = undefined;
        method = nextMethod;
        continue;
      }

      const responseBody = await readLimitedBody(response.body, responseHeaders, maxResponseBytes);
      return {
        status: response.statusCode,
        ok: response.statusCode >= 200 && response.statusCode < 300,
        headers: responseHeaders,
        body: responseBody,
        url: url.toString(),
      };
    } finally {
      await dispatcher.close();
    }
  }
}
