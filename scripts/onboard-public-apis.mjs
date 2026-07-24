#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const apiUrl = (process.env.MARKGIT_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

async function loadApiKey() {
  if (process.env.MARKGIT_API_KEY) return process.env.MARKGIT_API_KEY;
  const configDir = process.env.MARKGIT_CONFIG_DIR ?? join(homedir(), '.config', 'markgit');
  const config = JSON.parse(await readFile(join(configDir, 'config.json'), 'utf8'));
  if (!config.apiKey) throw new Error('No Markgit API key found. Run `markgit login` first.');
  return config.apiKey;
}

const tools = [
  {
    docsUrl: 'https://frankfurter.dev/',
    baseUrl: 'https://api.frankfurter.dev/v2/rates',
    draft: {
      name: 'Live Exchange Rates',
      slug: 'frankfurter-exchange-rates',
      description: 'Get current or historical exchange rates from the open-source Frankfurter API, which aggregates official central-bank data. Upstream docs: https://frankfurter.dev/',
      category: 'Finance',
      pricePerCallUsd: '0.0000',
      tags: ['finance', 'currency', 'exchange-rates', 'free', 'frankfurter'],
      inputSchema: {
        type: 'object',
        required: ['base', 'quotes'],
        properties: {
          base: {
            type: 'string',
            description: 'ISO 4217 base currency code.',
            example: 'USD',
          },
          quotes: {
            type: 'string',
            description: 'Comma-separated ISO 4217 target currency codes.',
            example: 'EUR,GBP',
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Optional historical date in YYYY-MM-DD format.',
            example: '2026-01-02',
          },
        },
      },
      outputSchema: {
        type: 'array',
        items: {
          type: 'object',
          required: ['date', 'base', 'quote', 'rate'],
          properties: {
            date: { type: 'string', format: 'date' },
            base: { type: 'string' },
            quote: { type: 'string' },
            rate: { type: 'number' },
          },
        },
      },
      executionConfig: {
        type: 'http_rest',
        protocol: 'markgit.tool/v1',
        method: 'GET',
        baseUrl: 'https://api.frankfurter.dev/v2/rates',
        timeoutMs: 10000,
        paramMapping: {
          base: { target: 'query', param: 'base' },
          quotes: { target: 'query', param: 'quotes' },
          date: { target: 'query', param: 'date' },
        },
        auth: {
          mode: 'none',
          type: 'none',
          location: 'header',
          name: 'Authorization',
        },
      },
    },
    testInput: { base: 'USD', quotes: 'EUR,GBP' },
  },
  {
    docsUrl: 'https://date.nager.at/api',
    baseUrl: 'https://nagerholidays.com/api/v4/Holidays/{countryCode}/{year}',
    draft: {
      name: 'Public Holidays',
      slug: 'nager-public-holidays',
      description: 'List national and regional public holidays for a country and year using the open-source Nager holiday API. Upstream docs: https://date.nager.at/api',
      category: 'Productivity',
      pricePerCallUsd: '0.0000',
      tags: ['calendar', 'holidays', 'countries', 'planning', 'free', 'nager'],
      inputSchema: {
        type: 'object',
        required: ['countryCode', 'year'],
        properties: {
          countryCode: {
            type: 'string',
            description: 'ISO 3166-1 alpha-2 country code.',
            pattern: '^[A-Z]{2}$',
            example: 'US',
          },
          year: {
            type: 'integer',
            minimum: 1900,
            maximum: 2200,
            description: 'Four-digit calendar year.',
            example: 2026,
          },
        },
      },
      outputSchema: {
        type: 'array',
        items: {
          type: 'object',
          required: ['date', 'name', 'countryCode', 'nationalHoliday', 'holidayTypes'],
          properties: {
            date: { type: 'string', format: 'date' },
            name: { type: 'string' },
            countryCode: { type: 'string' },
            nationalHoliday: { type: 'boolean' },
            subdivisionCodes: {
              anyOf: [
                { type: 'array', items: { type: 'string' } },
                { type: 'null' },
              ],
            },
            holidayTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      executionConfig: {
        type: 'http_rest',
        protocol: 'markgit.tool/v1',
        method: 'GET',
        baseUrl: 'https://nagerholidays.com/api/v4/Holidays/{countryCode}/{year}',
        timeoutMs: 10000,
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
      },
    },
    testInput: { countryCode: 'US', year: 2026 },
  },
  {
    docsUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/',
    baseUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    draft: {
      name: 'Earthquake Search',
      slug: 'usgs-earthquake-search',
      description: 'Search the official USGS earthquake catalog and receive GeoJSON suitable for maps and agent analysis. Upstream docs: https://earthquake.usgs.gov/fdsnws/event/1/',
      category: 'Data',
      pricePerCallUsd: '0.0000',
      tags: ['earthquakes', 'geospatial', 'geojson', 'science', 'free', 'usgs'],
      inputSchema: {
        type: 'object',
        required: ['starttime'],
        properties: {
          starttime: {
            type: 'string',
            format: 'date',
            description: 'Earliest event date in YYYY-MM-DD format.',
            example: '2026-07-20',
          },
          endtime: {
            type: 'string',
            format: 'date',
            description: 'Optional latest event date in YYYY-MM-DD format.',
            example: '2026-07-24',
          },
          minmagnitude: {
            type: 'number',
            minimum: -1,
            maximum: 10,
            description: 'Minimum event magnitude.',
            default: 4,
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Maximum number of events to return.',
            default: 10,
          },
          orderby: {
            type: 'string',
            enum: ['time', 'time-asc', 'magnitude', 'magnitude-asc'],
            default: 'time',
          },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['type', 'metadata', 'features'],
        properties: {
          type: { const: 'FeatureCollection' },
          metadata: {
            type: 'object',
            properties: {
              count: { type: 'integer' },
              title: { type: 'string' },
              status: { type: 'integer' },
            },
          },
          features: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                properties: {
                  type: 'object',
                  properties: {
                    mag: { type: ['number', 'null'] },
                    place: { type: ['string', 'null'] },
                    time: { type: 'integer' },
                    url: { type: 'string', format: 'uri' },
                  },
                },
                geometry: {
                  type: 'object',
                  properties: {
                    type: { const: 'Point' },
                    coordinates: { type: 'array', items: { type: 'number' } },
                  },
                },
              },
            },
          },
        },
      },
      executionConfig: {
        type: 'http_rest',
        protocol: 'markgit.tool/v1',
        method: 'GET',
        baseUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
        timeoutMs: 15000,
        paramMapping: {
          starttime: { target: 'query', param: 'starttime' },
          endtime: { target: 'query', param: 'endtime' },
          minmagnitude: { target: 'query', param: 'minmagnitude' },
          limit: { target: 'query', param: 'limit' },
          orderby: { target: 'query', param: 'orderby' },
        },
        staticParams: [
          { target: 'query', param: 'format', value: 'geojson' },
        ],
        auth: {
          mode: 'none',
          type: 'none',
          location: 'header',
          name: 'Authorization',
        },
      },
    },
    testInput: {
      starttime: '2026-07-20',
      minmagnitude: 4,
      limit: 2,
      orderby: 'time',
    },
  },
];

async function request(path, apiKey, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    const error = new Error(`${path}: ${message}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const apiKey = await loadApiKey();
const results = [];

for (const tool of tools) {
  try {
    const existing = await request(`/v1/registry/tools/${tool.draft.slug}`, null);
    results.push({ slug: tool.draft.slug, status: 'already_active', id: existing.id });
    continue;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const imported = await request('/v1/provider-imports', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      docsUrl: tool.docsUrl,
      baseUrl: tool.baseUrl,
      authMode: 'none',
    }),
  });

  await request(`/v1/provider-imports/${imported.id}/review`, apiKey, {
    method: 'POST',
    body: JSON.stringify(tool.draft),
  });

  const tested = await request(`/v1/provider-imports/${imported.id}/test`, apiKey, {
    method: 'POST',
    body: JSON.stringify({ input: tool.testInput }),
  });
  if (!tested.result?.success) {
    throw new Error(`${tool.draft.slug}: upstream harness test failed`);
  }

  const published = await request(`/v1/provider-imports/${imported.id}/publish`, apiKey, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  results.push({
    slug: published.product.slug,
    status: 'published',
    id: published.product.id,
    importSource: imported.sourceType,
    aiConfidence: imported.confidence,
  });
}

console.log(JSON.stringify({ apiUrl, results }, null, 2));
