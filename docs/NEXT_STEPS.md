# Tolty — Next Steps

What needs to happen to go from current state to a functional agent API marketplace.

## Current State Summary

**Working end-to-end:**
- Wallet funding via Stripe Checkout (user pays → webhook credits wallet)
- Hold-and-capture purchase flow (quote → hold → execute → capture/release)
- Marketplace CRUD (create products, search, browse)
- Provider Stripe Connect onboarding + daily auto-payouts
- Per-call earnings tracking and provider dashboard
- TypeScript SDK with all endpoints
- Next.js web frontend (dashboard, marketplace, wallet, provider)

**Not working yet:**
- Actual API execution (products don't make real HTTP calls)
- AI-powered doc ingestion and execution brokering
- Semantic search
- Policy/approval engine
- Async execution, subscriptions, notifications

---

## Phase 1: Real Execution Engine

**Goal**: When a user buys a product, Tolty actually calls the provider's API and returns real results.

### Tasks

1. **Define execution config schema** — Standardize what goes in `products.executionConfig`:
   ```json
   {
     "baseUrl": "https://api.weatherapi.com",
     "endpoint": "/v1/current.json",
     "method": "GET",
     "authType": "api_key_query",
     "authParam": "key",
     "timeout": 30000
   }
   ```

2. **Build execution runner** in `packages/api/src/services/execution-runner.ts`:
   - Read product's `executionConfig`
   - Inject provider auth credentials (stored securely, not in the product record)
   - Map user input to provider API params using `inputSchema`
   - Make the HTTP call with timeout and retry
   - Normalize the response using `outputSchema`
   - Store result in `executions.output`

3. **Add provider credentials storage** — New table `provider_credentials`:
   - `id`, `providerId`, `productId`, `credentialType`, `encryptedValue`, `createdAt`
   - Credentials injected at execution time only

4. **Update purchase service** (`packages/api/src/services/purchases.ts`):
   - Replace the placeholder execution with the real execution runner
   - Handle timeouts, errors, retries
   - On failure: release hold, mark execution failed

5. **Add execution result formatting** — Return structured results through `GET /v1/executions/:id/result`

### Files to modify
- `packages/api/src/services/purchases.ts` — replace mock execution
- New: `packages/api/src/services/execution-runner.ts`
- `packages/api/src/db/schema.ts` — add `provider_credentials` table

---

## Phase 2: Doc-Ingestion Agent

**Goal**: Provider submits a docs URL → AI reads the docs → generates a product card automatically.

This is the core differentiator. See `docs/provider-manifest-spec.md` for the target format.

### Tasks

1. **Build doc fetcher** — Fetch and parse API documentation from a URL (HTML, Markdown, OpenAPI spec)

2. **Build doc-ingestion agent** — Use Claude to:
   - Extract endpoints, methods, input/output schemas
   - Detect auth patterns (API key, bearer token, OAuth)
   - Classify side effects (`read_data`, `write_data`, etc.)
   - Extract pricing information if available
   - Generate a structured product card

3. **Add product creation from docs** — New endpoint:
   - `POST /v1/products/from-docs` — accepts `{ docsUrl, apiBaseUrl, description, authCredentials }`
   - Returns generated product card for review
   - Submitter confirms or edits before going live

4. **Build test-call validator** — After generating the product card, make a test call to verify the docs match the API behavior

5. **Add doc re-crawl** — Periodic re-crawl of docs URLs to detect breaking changes

### Files to create
- `packages/api/src/services/doc-ingestion.ts`
- `packages/api/src/services/doc-parser.ts`
- `packages/api/src/routes/product-ingestion.ts`

---

## Phase 3: Better Search

**Goal**: Agents can find the right API product using natural language queries.

### Tasks

1. **Add embeddings** — Generate embeddings for product name, description, capabilities, tags
   - Store in Neon with `pgvector` extension
   - New column on `products`: `embedding vector(1536)` (or whatever dimension)

2. **Semantic search endpoint** — Update `POST /v1/search` to:
   - Generate embedding for query
   - Combine cosine similarity with keyword match
   - Rank by relevance + trust tier + price + success rate

3. **Search result enrichment** — Include in results:
   - Price preview
   - Trust tier
   - Success rate (from execution history)
   - Whether user has previously approved this provider

---

## Phase 4: Approval and Policy Engine

**Goal**: Users control what agents can spend and do.

### Tasks

1. **Define permission classes**: `read_data`, `write_data`, `send_message`, `schedule_job`, `spend_money`

2. **Add policy tables**:
   - `user_policies` — per-user spending limits, auto-approve rules
   - `provider_approvals` — which providers a user has pre-approved
   - `product_approvals` — which products are pre-approved

3. **Policy check middleware** — Before every purchase:
   - Check spending limits (per-task, per-day)
   - Check provider approval status
   - Check side-effect permissions
   - Return `awaiting_approval` if policy requires it

4. **Approval flow**:
   - `POST /v1/purchases/:id/approve` — user approves a pending purchase
   - `POST /v1/purchases/:id/deny` — user denies
   - Webhook/notification to user when approval is needed

---

## Phase 5: Production Deployment

**Goal**: Run Tolty on a real URL with proper infrastructure.

### Tasks

1. **Deploy API** — Railway, Fly.io, or AWS. Needs:
   - Public URL for Stripe webhooks
   - Environment variables configured
   - Auto-restart on crash

2. **Deploy web frontend** — Vercel (natural fit for Next.js)

3. **Update Stripe webhooks** — Point to production URL instead of ngrok

4. **Set up monitoring** — Error tracking, request logging, uptime checks

5. **Rate limiting** — Add rate limits to API endpoints (per API key)

6. **Remove test bypasses**:
   - Remove or admin-gate `POST /v1/wallet/fund` (direct funding without Stripe)
   - Add proper input validation on all endpoints
   - Add CORS configuration

---

## Phase 6: Async Execution

**Goal**: Support APIs that take time to complete (polling, webhooks).

### Tasks

1. **Polling execution mode**:
   - Submit job → get execution ID → poll for completion
   - Background worker checks provider status endpoint
   - Timeout and retry logic

2. **Webhook callback mode**:
   - Register callback URL with provider
   - Receive completion webhook
   - Verify webhook signature
   - Complete execution and capture payment

3. **Execution state machine**: `pending → running → awaiting_callback → completed/failed/timed_out`

---

## Phase 7: USDC Payouts via Bridge

**Goal**: Pay providers in USDC for instant global settlement without Stripe Connect KYC.

### Tasks

1. **Integrate Bridge API** (Stripe-owned stablecoin orchestration):
   - USD-to-USDC conversion
   - Programmatic transfers to provider wallet addresses

2. **Update provider onboarding** — Let providers choose payout method:
   - Stripe Connect (bank transfer) — current default
   - USDC to wallet address — new option

3. **On-chain verification** — Store transaction hashes, confirm on-chain settlement

4. **Update payout service** — Support both rails in `runDailyPayouts()`

### Existing schema support
- `provider_payout_configs` table already exists with `chain` and `walletAddress`
- `payouts` table already has `chain`, `txHash`, `walletAddress` columns

---

## Phase 8: Subscriptions and Recurring Jobs

**Goal**: Agents can subscribe to recurring API executions.

### Tasks

1. **Subscription tables**: `subscriptions` with schedule, budget, delivery config
2. **Scheduler**: Cron-based job runner for recurring executions
3. **Per-run budget enforcement**: Each run checks remaining subscription budget
4. **Auto-pause on failures**: Pause after N consecutive failures
5. **Subscription management**: Create, pause, resume, cancel

---

## Phase 9: CLI

**Goal**: `tolty` command-line tool for testing and operator workflows.

```bash
tolty auth login
tolty wallet balance
tolty wallet fund --amount 50
tolty search "weather api"
tolty products inspect <id>
tolty products buy <id> --max-price 0.50
tolty executions status <id>
tolty executions result <id>
tolty providers register --name "My API" --docs-url https://...
```

Build as a new package: `packages/cli/`

---

## Phase 10: Notifications

**Goal**: Users get notified when actions need approval or results are ready.

### Tasks

1. **Email notifications** — SendGrid or Resend for:
   - Approval requests
   - Execution results
   - Low wallet balance
   - Payout confirmations

2. **Webhook callbacks** — Let agents register callback URLs for execution completion

3. **SMS** — Optional, for high-value approval requests

---

## Priority Order

If building sequentially, this is the recommended order:

| Priority | Phase | Why |
|----------|-------|-----|
| 1 | Real Execution Engine | Nothing works without this |
| 2 | Production Deployment | Need a real URL for testing and demos |
| 3 | Doc-Ingestion Agent | Core differentiator — zero-friction provider onboarding |
| 4 | Better Search | Agents need to find the right API |
| 5 | Approval & Policy | Required for real users with real money |
| 6 | USDC Payouts | Reduces provider onboarding friction |
| 7 | Async Execution | Many valuable APIs are async |
| 8 | Subscriptions | Recurring jobs unlock monitoring/reporting use cases |
| 9 | CLI | Nice to have for testing and developer experience |
| 10 | Notifications | Polish — users should know when things happen |

---

## Testing Checklist

Use these to verify the system end-to-end:

- [ ] Fund wallet via Stripe Checkout with test card `4242 4242 4242 4242`
- [ ] Search marketplace and find a product
- [ ] Get a quote for a product
- [ ] Purchase and execute a product
- [ ] Verify wallet balance decreases by the correct amount
- [ ] Verify provider earnings appear in provider dashboard
- [ ] Connect Stripe as a provider
- [ ] Verify daily payout creates a Stripe transfer
- [ ] Submit API docs URL and get auto-generated product card
- [ ] Agent makes a purchase via SDK and receives results
