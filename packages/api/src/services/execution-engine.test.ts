import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAdhocExecution } from './execution-engine.js';

describe('execution engine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('interpolates encoded path parameters before calling an upstream API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ name: 'New Year' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

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
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/holidays/US/2026',
      expect.objectContaining({ method: 'GET' }),
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
