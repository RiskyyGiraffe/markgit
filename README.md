# Markgit — Tool Registry and Commerce API

Markgit is a thin standardization and marketplace layer for tools used by people and agents. Tool publishers host their own endpoints. Free standardized tools can be called directly; paid tools use Markgit only for wallet authorization, metering, and settlement. Markgit is not a separate agent runtime.

**Repo**: [github.com/RiskyyGiraffe/markgit](https://github.com/RiskyyGiraffe/markgit)

## Install the CLI

```bash
npm install -g @markgit/cli
markgit login
markgit search "weather"
markgit balance
```

The CLI opens a browser link so the user can connect their account without copying an API key. See [Tool API v1](docs/tool-api.md) for the invocation contract and [LLM discovery](docs/llm-discovery.md) for JSON, OpenAPI, and `llms.txt` endpoints.

## Architecture

Monorepo using pnpm workspaces:

```
packages/
  api/     → Hono (Node.js) REST API — all business logic, Stripe integration, DB access
  sdk/     → TypeScript SDK — typed client for the Markgit API
  web/     → Next.js 15 frontend — dashboard, marketplace, wallet, provider pages
  cli/     → Thin installable client — account linking, search, balance, and calls
  tool-spec/ → Open JSON Schema for publisher-hosted tools
```

**Database**: Neon Serverless Postgres (project: `rapid-hall-03841072`)
**ORM**: Drizzle (schema-first, migrations via direct SQL on Neon)
**Payments**: Stripe (Checkout for wallet funding, Connect Express for vendor payouts)
**Auth**: API key-based (Bearer token), keys stored as SHA-256 hashes

## Quick Start

```bash
# Prerequisites: Node.js >=20, pnpm

# 1. Install dependencies
pnpm install

# 2. Copy env and fill in values (see "Environment Variables" below)
cp .env.example .env

# 3. Run the API server
pnpm dev

# 4. Run the web frontend (separate terminal)
pnpm dev:web

# 5. Run both together
pnpm dev:all
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | Neon Postgres connection string | [Neon Console](https://console.neon.tech) |
| `PORT` | API server port (default: 3000) | — |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` or `sk_live_...`) | [Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) | [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) |
| `NGROK_URL` | ngrok tunnel URL for local Stripe webhooks | `ngrok http 3000` |

The web app uses a separate `.env.local` in `packages/web/` for Next.js-specific config (auth, OAuth, cookie secrets). This file is gitignored.

## API Routes

All authenticated routes are under `/v1/` and require `Authorization: Bearer <api-key>`.

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Health check (no auth) |
| `/v1/registry/tools` | GET | Public searchable tool catalog with schemas, pricing, and usage |
| `/v1/registry/tools/:slug/docs` | GET | Exact machine-readable request and return contract |
| `/v1/registry/tools/:slug/openapi.json` | GET | Per-tool OpenAPI 3.1 document |
| `/v1/registry/llms.txt` | GET | Plain-text LLM registry index |
| `/webhooks/stripe` | POST | Stripe webhook endpoint (signature-verified, no auth) |
| `/v1/auth/keys` | POST | Create API key |
| `/v1/wallet` | GET | Get wallet balance |
| `/v1/wallet/fund` | POST | Fund wallet (direct — placeholder) |
| `/v1/wallet/fund/checkout` | POST | Create Stripe Checkout session for wallet funding |
| `/v1/wallet/ledger` | GET | Get wallet ledger entries |
| `/v1/search` | POST | Search marketplace products |
| `/v1/products` | GET/POST | List or create products |
| `/v1/products/:id` | GET | Get product details |
| `/v1/quotes` | POST | Create a price quote |
| `/v1/purchases` | GET/POST | List or create purchases |
| `/v1/executions` | GET | List executions |
| `/v1/executions/:id` | GET | Get execution details |
| `/v1/executions/:id/result` | GET | Get execution result |
| `/v1/providers` | POST | Register as provider |
| `/v1/providers/stripe/connect` | POST | Start Stripe Connect onboarding |
| `/v1/providers/stripe/status` | GET | Get Stripe account status |
| `/v1/providers/stripe/dashboard` | GET | Get Stripe Express dashboard link |
| `/v1/providers/earnings` | GET | Get earnings summary |
| `/v1/providers/earnings/calls` | GET | Per-call earnings log |
| `/v1/providers/payouts` | GET | Payout history |

## Web Pages

| Page | Path | Description |
|------|------|-------------|
| Login | `/login` | Auth (Better Auth via Neon Auth) |
| Dashboard | `/dashboard` | Overview |
| Marketplace | `/marketplace` | Browse and search products |
| Product Detail | `/marketplace/[id]` | View product, get quote, purchase |
| History | `/history` | Purchase and execution history |
| Wallet | `/wallet` | Balance, fund via Stripe, ledger |
| Provider | `/provider` | Stripe status, earnings, per-call log, payouts |
| Public tools | `/tools` | Searchable all-tool directory grouped by category |
| Public tool docs | `/tools/[slug]` | Human and machine-readable schemas and call flow |
| Documentation | `/docs` | LLM discovery and invocation overview |

## Database Schema

Key tables (defined in `packages/api/src/db/schema.ts`):

- `users` — email-based accounts
- `api_keys` — hashed API keys with permissions and budget limits
- `sessions` — API session tracking
- `providers` — vendor accounts (with Stripe Connect fields)
- `products` — marketplace listings (price, schema, execution config)
- `wallets` — user spend wallets
- `wallet_ledger_entries` — every credit/debit/hold/capture/release/refund
- `quotes` — priced offers with expiration
- `holds` — wallet fund reservations
- `purchases` — purchase lifecycle (created → authorized → running → completed/failed)
- `executions` — API call records (input, output, status, timing)
- `provider_earnings` — per-purchase earnings breakdown (gross, fee, net)
- `payouts` — disbursement records (Stripe transfer ID)
- `provider_payout_configs` — USDC wallet addresses (for future crypto payouts)
- `stripe_checkout_sessions` — idempotent webhook handling for Checkout

## What's Working (Real)

These features are fully implemented and functional:

- **Wallet funding via Stripe Checkout**: User clicks "Fund Wallet" → selects amount → redirects to Stripe Checkout → pays with test card → webhook credits wallet. Idempotent via `stripe_checkout_sessions` table.
- **Hold-and-capture billing**: Quote → hold funds → execute → capture on success / release on failure. Real ledger accounting.
- **Marketplace search and purchase flow**: Search products → get quote → buy → execute → see results. Full end-to-end sync execution.
- **Provider Stripe Connect onboarding**: Providers connect their Stripe Express account for payouts.
- **Per-call earnings tracking**: Every API call records gross, Markgit fee, and net earnings for the provider.
- **Daily auto-payouts**: `setInterval` cron sweeps all providers with active Stripe Connect + ≥$1 unpaid earnings, creates `stripe.transfers.create()` to their connected account.
- **Provider dashboard**: Shows Stripe account status, 4-column earnings summary, per-call earnings table, payout history.
- **Webhook handling**: `checkout.session.completed`, `checkout.session.expired`, `account.updated` — all with Stripe signature verification.
- **TypeScript SDK**: Fully typed client with all endpoints covered.
- **Next.js web frontend**: Dashboard, marketplace, wallet, provider pages with shadcn/ui components.

## What's Placeholder / Incomplete

These exist in code but are stubs or need real implementation:

| Feature | Status | Notes |
|---------|--------|-------|
| `POST /v1/wallet/fund` (direct) | **Placeholder** | Inserts a credit ledger entry with no real payment. Bypass for testing. Should be removed or admin-gated in production. |
| Product execution | **Basic remote gateway** | Sync provider calls and stored credentials work. Async calls and richer response validation still need implementation. |
| Search | **Working MVP** | Full-text, query expansion, and embedding-assisted ranking are implemented. |
| Provider trust tiers | **Schema only** | `trust_tier` column exists but no verification logic, no gating by tier. |
| Product status workflow | **Partial** | Status enum exists (`draft → pending_review → active → suspended → archived`) but no review queue or approval flow. |
| Approval / policy engine | **Working MVP** | Exact quotes, explicit CLI approval, API-key budgets, and global/per-tool spend controls are implemented. Rich permission classes remain future work. |
| Subscriptions / recurring jobs | **Not built** | Schema and flow not implemented. |
| Async execution (poll/webhook) | **Not built** | Only sync execution exists. |
| USDC / crypto payouts | **Schema only** | `provider_payout_configs` table and `chain`/`txHash`/`walletAddress` fields exist but no Bridge/Circle integration. Payouts currently go through Stripe Connect only. |
| Doc-ingestion agent | **Working MVP** | Provider imports can ingest documentation, generate a draft, run a test, and publish after review. More source formats and validation depth remain future work. |
| Execution broker agent | **Not built** | AI-powered API call construction from product cards is not implemented. Execution is a placeholder. |
| CLI | **Working MVP** | Browser account linking, public search/inspect, wallet status, direct free calls, paid gateway calls, and manifest publishing are implemented. npm/Homebrew release automation is not built yet. |
| Email/SMS notifications | **Not built** | No notification delivery. |
| Rate limiting | **Working MVP** | Global and per-tool per-minute/per-hour controls are enforced on tool calls. Platform-wide abuse protection remains future work. |
| Refund flow | **Not built** | `refunded` status exists but no refund logic. |

## What's Needed for Full End-to-End

To get a real marketplace where agents can discover, buy, and use APIs with real money:

1. **Real execution engine** — When a purchase is made, actually call the provider's API using `executionConfig`. Handle auth injection, timeouts, retries, response normalization.

2. **Deeper doc ingestion** — Expand the existing import pipeline with more source formats, stronger schema validation, and automated drift detection (see `docs/provider-manifest-spec.md`).

3. **Execution broker agent** — AI agent that uses the product card + original docs to construct correct API calls, interpret responses, and normalize output for the consuming agent.

4. **Better search** — Embeddings-based semantic search with ranking by trust, price, success rate, relevance.

5. **Richer permissions** — Extend existing quote approval, budgets, and spend/rate controls with per-task budgets and permission classes (`read_data`, `write_data`, `send_message`, `spend_money`).

6. **Remove direct fund endpoint** — Gate `POST /v1/wallet/fund` to admin-only or remove entirely. All real funding should go through Stripe Checkout.

7. **Production hardening** — Add provider redundancy, database quota monitoring, stronger abuse prevention, and documented recovery procedures.

## Project Structure

```
markgit/
├── package.json              # Root — pnpm workspace scripts
├── pnpm-workspace.yaml       # Workspace config
├── .env.example              # Environment template
├── .gitignore
├── docs/
│   ├── markgit-product-plan.md          # Full product and architecture plan
│   ├── wallet-settlement-model.md     # Billing, holds, captures, payouts spec
│   └── provider-manifest-spec.md      # Internal product card format spec
├── packages/
│   ├── api/                           # Hono REST API
│   │   ├── src/
│   │   │   ├── index.ts               # App entry, route mounting, daily cron
│   │   │   ├── db/
│   │   │   │   ├── index.ts           # Drizzle client
│   │   │   │   └── schema.ts          # All tables and enums
│   │   │   ├── lib/
│   │   │   │   ├── errors.ts          # AppError class
│   │   │   │   └── stripe.ts          # Stripe SDK singleton
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts            # API key auth
│   │   │   │   └── session.ts         # Session tracking
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts            # API key management
│   │   │   │   ├── wallet.ts          # Wallet + Stripe Checkout
│   │   │   │   ├── search.ts          # Product search
│   │   │   │   ├── products.ts        # CRUD products
│   │   │   │   ├── purchases.ts       # Quote + purchase flow
│   │   │   │   ├── executions.ts      # Execution status/results
│   │   │   │   ├── providers.ts       # Provider registration
│   │   │   │   ├── provider-stripe.ts # Stripe Connect + earnings + payouts
│   │   │   │   └── webhooks.ts        # Stripe webhooks
│   │   │   └── services/
│   │   │       ├── wallet.ts          # Wallet/ledger/hold/capture logic
│   │   │       ├── purchases.ts       # Quote/purchase/execution orchestration
│   │   │       ├── providers.ts       # Provider CRUD
│   │   │       ├── stripe-checkout.ts # Checkout session + webhook handlers
│   │   │       └── stripe-connect.ts  # Connect accounts + earnings + payouts
│   │   └── package.json
│   ├── sdk/                           # TypeScript SDK
│   │   ├── src/
│   │   │   ├── client.ts             # MarkgitClient class
│   │   │   ├── types.ts              # All request/response types
│   │   │   └── index.ts              # Barrel export
│   │   └── package.json
│   └── web/                           # Next.js 15 frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/      # Login page
│       │   │   ├── (app)/             # Authenticated app shell
│       │   │   │   ├── dashboard/     # Overview
│       │   │   │   ├── marketplace/   # Browse + product detail
│       │   │   │   ├── wallet/        # Balance + funding
│       │   │   │   ├── history/       # Purchase/execution history
│       │   │   │   └── provider/      # Provider dashboard
│       │   │   └── api/auth/          # Better Auth API routes
│       │   ├── actions/               # Server actions
│       │   ├── components/            # UI components
│       │   └── lib/                   # Auth, DB, utilities
│       └── package.json
```

## Key Design Decisions

- **Separate charges and transfers**: Markgit collects payment via Stripe Checkout (platform account), then uses `stripe.transfers.create()` to move provider net earnings to their Connect Express account. This gives Markgit full control over the money flow.
- **Wallet ledger is the source of truth**: Not Stripe's balance. Every movement (credit, hold, capture, release, refund) is an immutable ledger entry. Balance is derived from the ledger.
- **Idempotent webhook handling**: `stripe_checkout_sessions` table ensures duplicate webhook deliveries don't double-credit wallets.
- **Daily auto-payouts**: No manual payout requests. A cron sweeps all eligible providers daily and creates Stripe transfers.
- **API-first**: The SDK and web frontend consume the same REST API. The web frontend uses server actions that call the SDK.

## Design Documents

Read these for the full vision:

- [`docs/markgit-product-plan.md`](docs/markgit-product-plan.md) — Complete product plan, architecture, security model, billing design, and implementation roadmap
- [`docs/wallet-settlement-model.md`](docs/wallet-settlement-model.md) — Wallet ledger, hold/capture, quotes, purchases, refunds, and payout flow
- [`docs/provider-manifest-spec.md`](docs/provider-manifest-spec.md) — Internal product card format that the doc-ingestion agent generates

## Stripe Setup (Development)

1. Create a [Stripe account](https://dashboard.stripe.com)
2. Get your **secret key** (`sk_test_...`) from API keys
3. Set up a webhook endpoint pointing to `{your-url}/webhooks/stripe`
4. Subscribe to events: `checkout.session.completed`, `checkout.session.expired`, `account.updated`
5. Copy the webhook signing secret (`whsec_...`)
6. For local dev, use ngrok: `ngrok http 3000` and update `NGROK_URL` in `.env`

Test card: `4242 4242 4242 4242` (any future expiry, any CVC)

## Neon Database

Project ID: `rapid-hall-03841072`

Schema migrations are applied via direct SQL on Neon (not Drizzle migrations). The schema source of truth is `packages/api/src/db/schema.ts`.
