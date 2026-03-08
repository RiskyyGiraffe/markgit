import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../lib/errors.js';
import { importDocs } from './provider-imports.js';

const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
const originalOpenRouterModel = process.env.OPENROUTER_MODEL;

describe('provider imports', () => {
  afterEach(() => {
    vi.restoreAllMocks();

    if (originalOpenRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    }

    if (originalOpenRouterModel === undefined) {
      delete process.env.OPENROUTER_MODEL;
    } else {
      process.env.OPENROUTER_MODEL = originalOpenRouterModel;
    }
  });

  it('builds a draft from an OpenAPI document', async () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Dog Facts API', description: 'Return random dog facts' },
      servers: [{ url: 'https://dogs.example.com' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      paths: {
        '/facts': {
          get: {
            summary: 'Fetch dog facts',
            parameters: [
              {
                name: 'breed',
                in: 'query',
                required: true,
                schema: { type: 'string' },
                description: 'Dog breed filter',
              },
            ],
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        fact: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(spec), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await importDocs({
      docsUrl: 'https://docs.example.com/openapi.json',
      baseUrl: 'https://fallback.example.com',
      authMode: 'provider_managed',
    });

    expect(result.sourceType).toBe('openapi_json');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.draft.name).toBe('Dog Facts API');
    expect(result.draft.executionConfig.baseUrl).toBe('https://dogs.example.com/facts');
    expect(result.draft.executionConfig.method).toBe('GET');
    expect(result.draft.executionConfig.auth).toEqual({
      mode: 'provider_managed',
      type: 'bearer',
      location: 'header',
      name: 'Authorization',
      scheme: 'Bearer',
    });
    expect(result.draft.inputSchema).toMatchObject({
      required: ['breed'],
      properties: {
        breed: {
          type: 'string',
          description: 'Dog breed filter',
        },
      },
    });
  });

  it('rejects invalid OpenRouter JSON when falling back from HTML docs', async () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.OPENROUTER_MODEL = 'test-model';

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('<html><body><h1>Dog facts API</h1></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'not-json' } }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

    await expect(
      importDocs({
        docsUrl: 'https://docs.example.com/html',
        baseUrl: 'https://dogs.example.com/facts',
        authMode: 'buyer_supplied',
      }),
    ).rejects.toThrowError(new ValidationError('OpenRouter returned invalid JSON'));
  });
});
