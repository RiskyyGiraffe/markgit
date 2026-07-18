# Markgit CLI

Markgit is a thin client for the public tool registry, wallet, and standardized paid tool-call API. It is not an agent runtime and does not run a second agent on your machine.

```bash
npm install -g @markgit/cli
markgit login
markgit search "weather"
markgit inspect open-meteo-current-weather
markgit call open-meteo-current-weather --input '{"latitude":40.7,"longitude":-74}'
```

Providers can publish a hosted tool with `markgit publish ./markgit-tool.json`.

Use `MARKGIT_API_URL=http://localhost:3000` and `MARKGIT_WEB_URL=http://localhost:3001` for local development.
