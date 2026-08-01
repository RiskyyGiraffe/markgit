# Markgit CLI

Markgit is a thin client for the public tool registry, wallet, and standardized paid tool-call API. It is not an agent runtime and does not run a second agent on your machine.

```bash
npm install -g @markgit/cli
markgit login
markgit search "weather"
markgit quicklist add open-meteo-current-weather paid
markgit quicklist
markgit open-meteo-current-weather
markgit wallet
markgit inspect open-meteo-current-weather
markgit call paid-tool --input '{"city":"New York"}' --max-cost 0.02
```

The account quicklist syncs between the website and every linked CLI. `markgit quicklist` prints only its tool names; `markgit <quicklist-name>` returns the selected tool details and authorization. Each tool can use `paid` (ask for charged calls), `every` (ask every call), or `never` (standing authorization for the exact manifest version). Spend limits, blocked tools, and unverified endpoint warnings always remain enforced.

Paid calls always obtain an exact quote first. Use `--max-cost` for bounded agent approval or `--yes` for an explicit interactive approval. `markgit wallet` prints only the available balance.

Providers can register themselves and activate a hosted tool in one repeatable command:

```bash
markgit onboard ./markgit-tool.json
```

Wallet and policy commands:

```bash
markgit fund 10
markgit quicklist auth paid-tool every
markgit quicklist remove paid-tool
markgit limits set --per-call 1 --daily 5 --monthly 20 --rpm 60 --rph 1000
markgit limits tool paid-tool --per-call 0.10 --daily 1 --rpm 10 --rph 100
markgit limits tool paid-tool --inherit
markgit earnings
```

Use `MARKGIT_API_URL=http://localhost:3000` and `MARKGIT_WEB_URL=http://localhost:3001` for local development alongside Prexet.
