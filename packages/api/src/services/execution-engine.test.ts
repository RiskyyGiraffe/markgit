import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAdhocExecution } from './execution-engine.js';

const safeFetchTextMock = vi.hoisted(() => vi.fn());
vi.mock('../lib/safe-fetch.js', () => ({ safeFetchText: safeFetchTextMock }));

describe('execution engine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    safeFetchTextMock.mockReset();
  });

  it('interpolates encoded path parameters before calling an upstream API', async () => {
    safeFetchTextMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([{ name: 'New Year' }]),
      url: 'https://example.com/holidays/US/2026',
    });

    const result = await runAdhocExecution({
      type: 'http_rest',
      method: 'GET',
      baseUrl: 'https://example.com/holidays/{countryCode}/{year}',
      paramMapping: {
        countryCode: { target: 'path', param: 'countryCode' },
        year: { target: 'path', param: 'year' },
      },
      auth: {
        mode: 'none',
        type: 'none',
        location: 'header',
        name: 'Authorization',
      },
    }, {
      countryCode: 'US',
      year: 2026,
    });

    expect(result.success).toBe(true);
    expect(safeFetchTextMock).toHaveBeenCalledWith(
      'https://example.com/holidays/US/2026',
      expect.objectContaining({ method: 'GET', redirectPolicy: 'same-origin' }),
    );
  });

  it('rejects a call when a configured path parameter remains unresolved', async () => {
    const result = await runAdhocExecution({
      type: 'http_rest',
      method: 'GET',
      baseUrl: 'https://example.com/holidays/{countryCode}/{year}',
      paramMapping: {
        countryCode: { target: 'path', param: 'countryCode' },
      },
      auth: {
        mode: 'none',
        type: 'none',
        location: 'header',
        name: 'Authorization',
      },
    }, {
      countryCode: 'US',
    });

    expect(result).toMatchObject({
      success: false,
      errorMessage: 'Upstream URL contains an unresolved path parameter',
    });
  });
});
