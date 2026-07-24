# Curated public APIs

Run the complete docs-to-product workflow against a local Markgit API:

```bash
MARKGIT_API_URL=http://localhost:3000 npm run onboard:public-apis
```

The script:

1. sends each official documentation URL through Markgit's import pipeline;
2. reviews the AI/OpenAPI-generated draft against a curated JSON Schema;
3. calls the upstream API through Markgit's test harness;
4. publishes only after a successful test; and
5. skips any product whose stable slug is already active.

Initial products:

- Frankfurter live and historical exchange rates
- Nager public holidays
- USGS earthquake search

All three are keyless and are listed at zero cost. Their upstream documentation
and attribution links are retained in each public product description.
