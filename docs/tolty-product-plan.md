# Tolty Product and Architecture Plan

Companion specs:

- [Provider Manifest Spec](./provider-manifest-spec.md)
- [Wallet, Quote, Purchase, and Settlement Model](./wallet-settlement-model.md)

## 1. Product thesis

Tolty is a hosted marketplace and execution contract layer for agents. Any agent should be able to connect to Tolty, search for provider-published APIs or recurring jobs, buy or subscribe to them under clear policy limits, and receive results back in a machine-usable form.

The core idea is not "Tolty is the agent." The core idea is:

- anyone can list an API by pointing Tolty to its docs — no custom integration required
- Tolty's doc-ingestion agent reads the docs, extracts capabilities, and generates an internal product card
- Tolty's execution broker agent makes real API calls using the doc-derived understanding
- agents connect through a standard Tolty protocol to search, buy, and consume API products
- users control budgets, permissions, and approvals
- Tolty handles discovery, trust, billing, subscriptions, payouts, and delivery

The key insight: providers should not have to build anything custom for Tolty. The onboarding friction should be as close to zero as possible — submit your API URL, point to your docs, provide auth credentials, and give us a wallet address for payouts. Tolty's AI does the rest.

If this works, Tolty becomes the marketplace and control plane between agents and third-party execution providers.

## 2. Product principles

1. User control beats agent autonomy.
2. Spending money is a first-class permission boundary.
3. Every tool call must be inspectable, replayable, and attributable.
4. Provider onboarding must be zero-friction: point to docs, provide auth, receive payouts.
5. External API content is untrusted input, not instructions.
6. Model and runtime choices should be replaceable; the marketplace should not depend on one provider.
7. Tolty should be agent-agnostic; first-party agent experiences are useful, but not the product boundary.
8. Tolty's AI reads and understands provider APIs — providers should never have to write custom integration code.

## 3. Target user experience

### Example requests

- "Book me the cheapest nonstop flight under $500 and ask before purchase."
- "Monitor this SKU and buy it if the price drops below $120."
- "Search tax filing APIs and summarize the top 5 that can file for Delaware LLCs."
- "Pull my sales data weekly, format as CSV and PDF, and email it to finance."
- "Find an API that can enrich this lead list, test two vendors, and use the cheaper one going forward."

### Required behaviors

- answer normally if no tool is needed
- let an external agent search the Tolty marketplace when a tool or recurring job is needed
- request approval before sensitive actions unless the user pre-approved them
- let the agent buy a one-time API action or subscribe to a recurring job
- deliver results back to the agent or user in structured formats
- continue a multi-step loop until the task is complete, blocked, or budget/policy is exhausted

## 4. Product scope

### In scope for v1

- hosted marketplace for APIs and recurring jobs
- agent integration API and SDK
- first-party CLI for testing and operator workflows
- user spend wallet with balance checks
- API marketplace discovery
- approved tool memory per user and per workspace
- one-time purchases and recurring subscriptions
- sync and async job execution
- budget and approval controls
- notifications by email and SMS
- provider onboarding with manifests and verification
- user-published and agent-published products
- platform billing and provider payouts

### Explicit non-goals for initial MVP

- Tolty being the only supported agent runtime
- arbitrary code execution by third-party providers inside Tolty infrastructure
- autonomous spending with no user-configurable policy controls
- a completely open marketplace with zero review
- dozens of pricing models at launch

## 5. Recommended architecture

### 5.1 Major components

1. Agent integration API
   - marketplace search
   - purchase and subscription endpoints
   - approvals and policy checks
   - wallet balance and funding status
   - result retrieval and callback registration
   - session / execution state access

2. Tolty API / control plane
   - auth
   - sessions
   - policy engine
   - tool registry
   - billing
   - provider onboarding
   - scheduling
   - notification routing

3. Doc-ingestion agent
   - reads provider API documentation from submitted URL
   - extracts endpoints, input/output schemas, auth patterns, rate limits, pricing
   - generates internal product cards (normalized manifest format)
   - runs test calls to validate docs match actual API behavior
   - re-crawls docs on schedule or on-demand to detect changes
   - flags discrepancies between docs and actual responses for review

4. Execution broker agent
   - uses stored product card plus original docs to construct API calls
   - injects auth credentials at call time
   - interprets provider responses using doc-derived understanding
   - normalizes outputs for consuming agents
   - handles retries and error interpretation
   - tracks execution state

5. Tool gateway
   - normalized execution layer for provider APIs
   - auth token injection
   - retries
   - idempotency
   - observability
   - webhook verification

6. Marketplace registry
   - provider profiles
   - generated product cards (internal manifest format)
   - pricing metadata
   - trust tier
   - verification status
   - product fit descriptors
   - original doc URLs and cached doc content

7. Billing and payouts system
   - customer billing via Stripe (fiat inbound)
   - wallet ledger
   - authorization holds
   - usage metering
   - provider earnings
   - crypto/stablecoin payouts via Bridge or Circle (USDC outbound)
   - reserves and dispute handling

8. Scheduler and subscription runner
   - recurring jobs
   - delayed resume
   - polling
   - timeout recovery

### 5.2 Marketplace execution model

Tolty should expose a standard flow that any agent can use:

1. search products or recurring jobs
2. inspect capability, price, trust tier, and result contract
3. request quote or estimate
4. request approval if required by user policy
5. purchase one-time execution or subscribe to recurring execution
6. receive status changes and results through pull or push delivery
7. renew, cancel, or reuse approved products later

Important constraints:

- every purchase and execution writes an audit record
- every action includes estimated cost, actual cost, and approval state
- recurring jobs inherit policy but are still bounded by active budget and trust rules
- Tolty can pause a job when waiting for webhook, approval, or provider completion

### 5.3 Agent compatibility model

Tolty should not assume one model provider, one agent framework, or one runtime pattern.

Recommended model:

- define a Tolty HTTP API first
- add SDKs for common agent stacks later
- expose structured search, quote, buy, subscribe, cancel, and fetch-result endpoints
- support agent callback URLs and agent polling
- treat subagents as an external agent concern unless Tolty later offers a hosted runtime

### 5.4 Optional first-party runtime

Tolty may still offer its own CLI or hosted runtime later, but that should be built on the same marketplace APIs external agents use.

This keeps the core platform honest:

- the marketplace does not depend on one model or runtime vendor
- the marketplace does not depend on one CLI design
- a first-party agent can exist without becoming the architectural center of the product

## 6. API marketplace design

### 6.1 Core concept

Providers do not expose arbitrary prose to an agent and hope for the best. They publish a structured tool contract that Tolty compiles into a normalized internal tool definition.

The marketplace unit should be a `product`, not just an endpoint.

A product can expose:

- what job it does
- supported use cases
- required auth method
- price model
- latency characteristics
- sync vs async behavior
- trust tier
- output schema
- side effects
- refund / failure behavior

Each product should also expose one simple entry contract:

- what the product can do
- what inputs it needs
- what it returns
- what it can cost
- how it is executed

### 6.2 Provider onboarding and doc ingestion

Providers do not write custom manifests or integration code. Tolty's doc-ingestion agent reads existing API documentation and generates an internal product card.

Minimum viable provider submission for v1:

- API base URL
- documentation URL (or pasted/uploaded docs)
- one-sentence description of what the API does
- auth credentials (API key, OAuth config, etc.)
- wallet address for payouts (USDC on supported chain)

Tolty's doc-ingestion agent then:

1. fetches and reads the documentation
2. extracts endpoints, input/output shapes, auth patterns, rate limits, and pricing
3. classifies side effects: `read_data`, `write_data`, `send_message`, `schedule_job`, `spend_money`
4. generates an internal product card in Tolty's normalized manifest format
5. runs test calls to verify docs match actual API behavior
6. presents the generated product card to the submitter for review and correction
7. stores the validated product card and original doc URL

The internal manifest format is defined in [provider-manifest-spec.md](./provider-manifest-spec.md). This is an internal schema that Tolty generates — providers never author it directly.

When API docs change:

- Tolty can re-crawl docs on schedule or on-demand
- the doc-ingestion agent diffs changes and flags material contract changes
- breaking changes (input/output schema, auth, pricing) create a new product version
- the submitter is notified and may need to confirm updates

For public listings, domain verification is still required. Submitters must prove they control the API domain or are authorized to list it.

### 6.3 Product endpoint

Your idea that each API should have a product endpoint is correct. It should answer: "Can this API handle the use case, under what constraints, and with what cost/risk?"

Recommend a product capability endpoint that returns:

- supported operations
- required inputs
- optional inputs
- expected SLA / latency
- price estimate method
- async completion pattern
- compliance tags
- sample outputs
- confidence / applicability hints

An external agent or Tolty's own first-party client can use this endpoint before choosing a product for execution.

### 6.4 Search and ranking

Marketplace search should rank tools by more than keyword match.

Ranking inputs:

- semantic relevance
- trust tier
- historical success rate
- cost estimate
- latency
- output quality score
- refund/dispute rate
- policy compatibility
- user-approved history

The agent should prefer already approved tools unless there is a clear reason not to.

### 6.5 One-time APIs vs recurring jobs

Tolty should support two marketplace primitives:

- one-time actions
- recurring jobs / subscriptions

Recurring jobs are not just "cron plus an API." They are products with their own lifecycle:

- subscription start
- schedule definition
- delivery target
- pause / resume / cancel
- execution history
- spend controls

### 6.6 Product ownership and publishing

Products can be posted by:

- providers
- end users
- workspaces
- agents acting on behalf of a user or workspace

The owner of a product is responsible for:

- manifest accuracy
- endpoint maintenance
- payout destination
- support contact
- policy classification
- webhook validity

Agents may publish products only with explicit permission such as `publish_product`. Agent-published products should default to private or unlisted until reviewed.

### 6.7 REST vs webhook vs async jobs

Do not model these as three unrelated systems. Model them as one `Action` abstraction with different completion strategies.

Action types:

- sync request/response
- async polling job
- async webhook callback

Every action should share:

- normalized input schema
- idempotency key
- correlation id
- timeout policy
- retry policy
- state machine: `queued`, `running`, `awaiting_callback`, `completed`, `failed`, `expired`

This avoids product complexity exploding when providers use different integration patterns.

## 7. Security model

This is the hardest area and should shape the marketplace from day one.

### 7.1 Threat model

You are exposed to:

- prompt injection from provider descriptions
- prompt injection from provider responses
- malicious API side effects
- hidden spend escalation
- account takeover
- abusive recurring subscriptions
- webhook spoofing
- provider fraud
- bad schemas that cause dangerous tool misuse
- data exfiltration through overly broad tool access

### 7.2 Core security rules

1. Treat all external API responses as untrusted data.
2. Separate tool metadata from agent-visible instructions.
3. Require structured schemas for inputs and outputs.
4. Force explicit side-effect declarations.
5. Apply policy checks before every side-effecting call.
6. Isolate credentials per user, workspace, and provider.
7. Log everything needed for audit and dispute resolution.

### 7.3 Anti-prompt-injection design

The main defense is architecture, not prompting.

Recommended controls:

- provider manifests are parsed into strict internal fields
- free-form provider text is never treated as executable instruction priority
- provider responses are tagged as untrusted observations
- the planner uses system policy that forbids changing permissions based on tool output
- providers cannot create or enable new tools dynamically without marketplace review
- high-risk actions require policy confirmation from the control plane, not only model judgment

Prompting still matters, but prompt-only defenses are not enough.

### 7.4 Permission model

Create explicit permission classes:

- `read_data`
- `write_data`
- `send_message`
- `subscribe_job`
- `spend_money`
- `call_unverified_provider`

Every tool and action maps to one or more classes. User policies then approve, deny, or require confirmation for each class.

### 7.5 Autonomy controls

Users should control:

- max spend per task
- max spend per day
- max provider price per call
- whether new providers need approval
- whether write actions need approval
- whether recurring subscriptions can be created
- whether messages can be sent externally

Recommended UX:

- `manual`: approve all side effects
- `guarded`: pre-approved low-risk reads, confirm writes/spend
- `bounded`: allow actions within strict limits
- `delegated`: broad execution within explicit budgets and approved providers

### 7.6 Provider trust tiers

Not all providers should be equal.

Suggested tiers:

- Tier 0: unverified
- Tier 1: domain verified + manifest validated
- Tier 2: functional review passed
- Tier 3: billing verified + webhook verified + production reliability history
- Tier 4: strategic / certified providers

High-risk actions should be limited to higher trust tiers.

### 7.7 Secrets and auth

Support:

- user-supplied API keys
- OAuth where possible
- scoped delegated credentials
- workspace service accounts where appropriate

Rules:

- never expose raw secrets unnecessarily to agents or models
- inject credentials only at execution time in the tool gateway
- store secrets in a proper secret manager
- rotate and revoke per provider
- maintain a clear mapping between which user authorized which provider

### 7.8 Webhook security

Required controls:

- signed webhook verification
- replay protection
- expiration window checks
- provider-specific secret per endpoint
- event deduplication
- correlation to known pending actions only

### 7.9 Abuse and fraud controls

You will need:

- provider rate limits
- workspace rate limits
- anomaly detection on spend spikes
- delayed payout / reserve policy for new providers
- dispute and refund workflows
- manual review queue for suspicious providers

## 8. Billing, monetization, and payouts

This is the other hardest part.

### 8.1 Recommended business model

Tolty should bill the customer and pay providers. Tolty should act as merchant of record for the public marketplace experience. Do not make the user separately contract with every API provider for the main marketplace experience.

Recommended default:

- customer prepays or has a billed Tolty account
- Tolty meters usage per tool call
- Tolty charges the customer
- Tolty remits earnings to providers on a payout schedule
- Tolty keeps a take rate

Why this is the better default:

- simpler buyer experience
- consistent approvals and budgets
- easier cost estimation inside external agent workflows
- easier provider monetization
- easier to search and compare tools
- cleaner recurring subscription billing

### 8.2 Wallet model

Users should have a Tolty spend wallet that the agent can inspect before attempting paid actions.

Recommended v1 design:

- each user or workspace has a wallet balance
- the wallet is funded through Tolty-managed payment methods
- the wallet has an internal ledger, not just a payment processor customer record
- agent access to balance is policy-controlled
- purchases create authorization holds before execution
- final settlement captures only the actual charged amount
- unused holds are released

Why an internal wallet is the right first implementation:

- simple CLI UX
- easy budget enforcement
- deterministic spend checks for agents
- clean support for recurring subscriptions
- easier dispute handling and refunds

If "connect a wallet" later needs to include crypto or third-party stored-value systems, that should be added as funding adapters behind the same Tolty wallet abstraction.

The authoritative billing flow and ledger contract is defined in [wallet-settlement-model.md](./wallet-settlement-model.md).

### 8.3 Payments stack recommendation

Use a hybrid model: traditional payment rails for user funding, crypto rails for provider payouts.

Customer side (inbound):

- Stripe Billing for wallet funding, subscriptions, and credits
- credit card and ACH as primary funding methods
- Stripe handles customer billing, invoicing, and payment disputes

Provider side (outbound):

- USDC stablecoin payouts via Bridge (Stripe-owned) or Circle
- providers submit a wallet address during onboarding
- payouts are near-instant, low-fee, and globally accessible
- fully auditable on-chain
- optional traditional payout rail (Stripe Connect) for providers who require bank deposits

Why this hybrid model:

- eliminates Stripe Connect KYC friction for provider onboarding
- instant global settlement without currency conversion or SWIFT delays
- transaction fees are fractions of a cent on L2 chains (Base, Solana)
- users still fund with familiar payment methods (credit card, ACH)
- on-chain payout records provide transparent, immutable audit trail

Recommended vendors:

- Bridge (Stripe-owned): stablecoin orchestration API, USD-to-USDC conversion, programmatic transfers
- Circle: USDC issuer, programmable wallets and payout APIs
- Stripe Billing: customer-side billing and wallet funding

### 8.4 Pricing models to support first

Support only a small set at launch:

1. per successful call
2. per unit of usage
3. monthly subscription plus usage

Avoid at launch:

- success-fee pricing tied to user business outcomes
- complex auctions between providers
- dynamic surge pricing

### 8.5 Spend authorization model

For money-moving actions, the agent should not simply execute because the model thinks it is helpful.

Use a two-step pattern:

1. estimate the expected cost or price range
2. check policy and user approval against that estimate before execution

For actions with uncertain final price:

- require a `not_to_exceed` ceiling
- store it with the action
- reject execution if provider attempts to exceed the ceiling

### 8.6 Provider payouts

Payout method: USDC stablecoin to provider-specified wallet address.

Suggested payout policy:

- initial payout delay for new providers (7-14 days)
- rolling reserve for high-risk categories
- dispute holdback
- minimum payout threshold
- transparent payout statements with execution ids
- on-chain transaction hashes linked to payout records

This protects the platform against refunds, chargebacks, fraud, and low-quality providers.

Providers who require traditional bank payouts can opt into Stripe Connect as an alternative rail. This requires standard KYC and adds processing time.

Tax reporting:

- Tolty must still issue 1099s (US) or equivalent for providers earning above thresholds
- provider KYC can be deferred until payout thresholds are reached rather than required at onboarding
- crypto payouts do not exempt Tolty from tax reporting obligations

### 8.7 Marketplace economics questions

You need explicit answers to:

- does Tolty set end-user pricing, or do providers set pricing and Tolty adds a fee?
- are refunds funded by the provider, Tolty, or split by policy?
- do users buy credits first, or postpay monthly?
- can providers offer free test tiers for agent selection?
- can the agent compare providers by cost in real time?

Recommended v1 answer:

- providers set base pricing within Tolty-defined pricing primitives
- Tolty adds a visible marketplace fee
- users can use prepaid credits or invoiced billing if approved
- providers may offer test calls
- agent can compare cost estimates before asking approval

## 9. Memory and approvals

### 9.1 Remember approved APIs

Approval memory should be structured, not just conversational.

Store:

- approved provider ids
- approved products
- approved permission classes
- budget ceilings
- scope of approval: user, workspace, or session
- expiration date
- audit trail

Example:

- "Provider X may read CRM data for workspace Y for 90 days up to $200/month."

### 9.2 Session memory

Persist:

- conversation history summary
- execution trace
- provider approval state
- user preferences for formats and notification channels
- recurring subscriptions

Do not blindly reuse long raw transcripts as system memory. Store normalized state.

## 10. Integration surfaces

Tolty should present a clean protocol to agents first, then layer first-party interfaces on top.

### 10.1 Agent integration API

Core endpoints should cover:

- search products
- inspect product capability and pricing
- check wallet balance
- list approved providers and products
- request quote
- buy action
- subscribe recurring job
- cancel subscription
- fetch execution status
- fetch results
- register callback destination
- manage approvals and policies

### 10.2 First-party CLI

The CLI is still useful, but as one client of the marketplace rather than the architectural center.

Suggested commands:

```bash
tolty auth login
tolty wallet balance
tolty wallet fund --amount 100
tolty providers search "flight booking"
tolty providers approve provider_123
tolty products inspect product_123
tolty products buy product_123 --max-price 25
tolty subscriptions create product_456 --cron "0 9 * * 1" --delivery email
tolty subscriptions cancel sub_123
tolty products publish --manifest .\\tolty-product.json
tolty products retire product_123
tolty sessions list
tolty sessions resume sess_123
tolty policies show
tolty policies edit
tolty executions status exec_123
tolty executions result exec_123
tolty subscriptions list
tolty inbox
```

### 10.3 Delivery model

Agents should be able to receive results through:

- synchronous response
- polling
- webhook callback
- email or SMS relay for user-facing workflows

## 11. Specific implementation blueprint

This section turns the marketplace idea into a concrete v1 system.

### 11.1 Core interaction flow

The basic Tolty flow should be:

1. provider or user submits API URL, docs URL, auth credentials, and payout wallet address
2. Tolty's doc-ingestion agent reads the docs and generates an internal product card
3. Tolty runs test calls to validate docs match actual API behavior
4. submitter reviews and confirms the generated product card
5. product goes live (or into review queue for public listings)
6. consuming agent searches Tolty for a capability
7. Tolty returns normalized products with price, trust, and input schema
8. agent inspects one product in detail
9. agent checks whether it is approved and whether wallet balance is sufficient
10. agent requests quote if needed
11. agent asks for approval if policy requires it
12. agent buys the product or subscribes to it
13. Tolty's execution broker agent constructs and executes the provider API call
14. Tolty returns or delivers the result
15. Tolty settles the charge and updates wallet balance
16. provider earning is recorded and paid out in USDC on schedule

### 11.2 Minimum provider submission

To list an API on Tolty, a provider or user submits:

- API base URL
- documentation URL (or pasted/uploaded docs)
- one-sentence description of what the API does
- auth credentials (API key, bearer token, OAuth config)
- payout wallet address (USDC on supported chain)
- contact email

Tolty's doc-ingestion agent then generates an internal product card containing:

- product id and version
- title and summary
- capability tags
- input schema (extracted from docs)
- output schema (extracted from docs)
- side-effect classification
- pricing type and amounts
- execution mode: sync, poll, webhook
- auth requirements
- endpoint URLs

The submitter reviews the generated card and can correct any fields the agent got wrong. The internal product card format is defined in [provider-manifest-spec.md](./provider-manifest-spec.md).

### 11.3 Normalized product states

Products should move through:

- `draft`
- `submitted`
- `validated`
- `review_required`
- `approved`
- `suspended`
- `retired`

Executions should move through:

- `created`
- `quoted`
- `awaiting_approval`
- `authorized`
- `running`
- `awaiting_callback`
- `completed`
- `failed`
- `refunded`

Subscriptions should move through:

- `active`
- `paused`
- `canceled`
- `past_due`

### 11.4 Wallet flow

The agent should be able to call:

- get wallet balance
- get remaining approved budget
- create quote hold
- release hold
- settle charge

Recommended purchase sequence:

1. agent requests quote
2. Tolty checks active wallet balance and policy
3. Tolty places a hold for quoted or not-to-exceed amount
4. provider execution starts
5. on completion, Tolty settles actual amount
6. hold remainder is released
7. provider earning moves into pending payout

This section is a summary only. The source of truth is [wallet-settlement-model.md](./wallet-settlement-model.md).

### 11.5 Agent-posted and user-posted APIs

Publishing should use the same flow regardless of who posts:

- create provider account
- create product
- upload manifest or point Tolty to manifest URL
- validate schema and endpoints
- assign visibility: private, unlisted, public
- run review policy
- approve for listing

If an agent posts a product:

- it must act on behalf of an authenticated user or workspace
- it cannot self-approve public listing
- it cannot bypass review or trust gating
- it can create private tools for a specific workspace if allowed by policy

### 11.6 What the CLI needs to support

The CLI should let users:

- log in
- fund wallet
- check wallet balance
- search marketplace
- inspect a product
- approve a provider
- buy a product
- subscribe to a recurring job
- list subscriptions
- view execution status
- fetch results
- publish a product
- suspend or retire their product

### 11.7 Minimum agent API surface

Recommended first endpoints:

- `POST /v1/search`
- `GET /v1/products/{id}`
- `GET /v1/wallet`
- `POST /v1/quotes`
- `POST /v1/purchases`
- `POST /v1/subscriptions`
- `GET /v1/executions/{id}`
- `GET /v1/executions/{id}/result`
- `POST /v1/products`
- `POST /v1/products/{id}/submit`
- `POST /v1/providers/{id}/approve`

### 11.8 Search result shape

Search results should return:

- product id
- title
- summary
- owner
- trust tier
- price preview
- fixed vs quoted pricing
- sync vs async mode
- approval required flag
- input summary
- output summary
- last validation status

## 12. Notifications and delivery channels

Support three output patterns:

1. return to the calling agent or current session
2. send to external channel
3. store for later pickup

Recommended v1 channels:

- chat session
- email
- SMS
- webhook callback

Every outbound delivery should be a permissioned side effect with templates, audit logs, and retry handling.

## 13. Recurring subscriptions and waiting

Recurring subscriptions are valuable but dangerous.

Design rules:

- recurring subscriptions require explicit user confirmation
- every subscription stores schedule, budget, allowed providers, and output channel
- subscriptions can be paused automatically on repeated failures or spend anomalies
- each recurrence runs as a new execution with inherited but reviewable policy

For wait states:

- support `sleep until`, polling, and webhook resume
- keep long-running workflows as durable state machines, not one giant live model session

## 14. Hard parts and likely failure modes

### 14.1 Hard parts

1. Safe product execution with open provider onboarding.
2. Billing and payout mechanics for a two-sided marketplace.
3. Approval UX that is safe without being miserable for external agents and end users.
4. Reliable async orchestration across polling, webhooks, and recurring subscriptions.
5. Provider quality control and trust scoring.
6. Designing one marketplace protocol that many agent stacks can adopt.

### 14.2 Likely failure modes

- too much flexibility in provider manifests creates prompt-injection risk
- too much friction in approvals makes the product unusable
- unclear pricing causes users to distrust autonomy
- weak provider screening turns the marketplace into spam
- no holdbacks or reserves makes fraud expensive
- overfitting the product to one agent runtime causes ecosystem adoption problems
- putting business logic in prompts instead of policy code causes safety regressions

## 15. Suggested MVP

### 15.1 MVP scope

Build a narrow but defensible first product:

- hosted marketplace API
- doc-ingestion agent that reads API docs and generates product cards
- execution broker agent that makes real API calls from doc-derived understanding
- zero-friction provider onboarding: submit URL, docs, auth, wallet address
- wallet ledger with simple debit-on-success (holds can be deferred to v1.1)
- Stripe for customer billing (wallet funding)
- USDC payouts to providers via Bridge or Circle
- marketplace with curated providers initially, self-serve publishing with review
- one-time sync actions as the primary execution mode
- strict budget and approval controls
- basic search (keyword plus embeddings)
- test call validation during onboarding

### 15.2 Provider categories to start with

Start with low-risk, high-utility APIs:

- search / enrichment
- data extraction
- reporting
- communications with explicit approval

Delay higher-risk categories until policy and billing are stable:

- commerce purchasing
- funds movement
- legal filing
- healthcare actions

### 15.3 What not to ship in MVP

- open self-serve provider publishing with no review
- fully autonomous purchasing
- complex multi-party settlements
- browser automation as a core product path
- async/webhook/polling execution (start sync-only)
- recurring subscriptions (defer to v1.1)
- CLI (API-first, validate with one agent integration)
- multi-channel notifications (email/SMS delivery can be deferred)

## 16. Implementation task list

This is the running task list to get Tolty functional.

### 16.1 Foundation

- define account model: user, workspace, provider, agent actor
- define auth model for CLI, API, and provider ownership
- choose backend stack and repo structure
- set up database, migrations, and environment management
- define event ids, correlation ids, and audit log format

### 16.2 Marketplace schema

- define normalized provider schema
- define normalized product schema
- define pricing schema
- define quote schema
- define execution schema
- define subscription schema
- define payout schema
- define review and trust-tier schema

### 16.3 Doc-ingestion agent and product card generation

- implement doc-ingestion agent that reads API documentation from a URL
- implement endpoint extraction from docs
- implement input/output schema extraction from docs
- implement auth pattern detection from docs
- implement pricing extraction from docs
- implement side-effect classification from docs
- implement internal product card generation in normalized manifest format ([provider-manifest-spec.md](./provider-manifest-spec.md))
- implement test call validation against extracted endpoints
- implement submitter review and correction flow for generated product cards
- implement doc re-crawl on schedule and change detection
- implement product visibility rules

### 16.4 Search and discovery

- implement keyword and semantic search
- implement filters for trust tier, price type, sync/async, and side effects
- implement ranking using trust, price, success rate, and approval history
- implement product inspect endpoint
- implement CLI search and inspect commands

### 16.5 Wallet and billing

- create Tolty wallet ledger tables
- implement funding flow via Stripe (credit card, ACH)
- implement wallet balance endpoint
- implement debit-on-success for v1 (authorization holds deferred to v1.1)
- implement settlement logic
- implement refund flow
- implement [wallet-settlement-model.md](./wallet-settlement-model.md)
- connect Stripe Billing for customer-side payments
- implement USDC payout rail via Bridge or Circle
- implement provider earnings ledger
- implement provider payout scheduling
- implement on-chain payout verification
- optional: connect Stripe Connect for providers who require bank deposits

### 16.6 Approval and policy engine

- define permission classes
- define approval scopes: session, user, workspace
- implement provider approval records
- implement budget rules
- implement trust-tier gating
- implement approval prompts in CLI
- implement reusable approval memory

### 16.7 Purchase and execution flow

- implement quote endpoint
- implement purchase endpoint
- implement execution creation
- implement execution broker agent that constructs API calls from product cards and docs
- implement sync execution flow
- implement result normalization and interpretation
- implement execution audit trail
- defer: async polling broker (v1.1)
- defer: webhook callback broker (v1.1)

### 16.8 Subscriptions

- implement subscription create endpoint
- implement scheduler
- implement per-run budget enforcement
- implement automatic pause on repeated failures
- implement subscription cancellation
- implement subscription history view

### 16.9 Provider publishing

- implement provider account creation
- implement product draft creation
- implement product submission flow
- implement private, unlisted, and public listing states
- implement review queue
- implement approve, suspend, and retire actions
- implement CLI publish commands

### 16.10 Agent-posted products

- define `publish_product` permission
- allow agents to create private products on behalf of users
- require explicit review for public listings
- log actor identity for every publish action
- prevent self-approval by the posting agent

### 16.11 Result delivery

- implement inline sync responses
- implement polling status endpoint
- implement webhook registration and delivery
- implement email and SMS relay
- implement retry and dead-letter handling

### 16.12 Security

- implement secrets management
- implement signed webhook verification
- implement replay protection
- implement rate limits
- implement anomaly detection hooks for spend spikes
- implement provider fraud review tooling
- implement immutable audit logs for purchases and payouts

### 16.13 CLI

- build `tolty auth login`
- build `tolty wallet balance`
- build `tolty wallet fund`
- build `tolty providers search`
- build `tolty products inspect`
- build `tolty providers approve`
- build `tolty products buy`
- build `tolty subscriptions create`
- build `tolty executions status`
- build `tolty executions result`
- build `tolty products publish`
- build `tolty subscriptions list`

### 16.14 Analytics and ops

- track search-to-purchase conversion
- track provider success rates
- track refund rate
- track payout delays
- build admin dashboard for review and disputes

### 16.15 Recommended build order

1. schema, auth, and account model
2. doc-ingestion agent (read docs, generate product cards)
3. execution broker agent (make API calls from product cards)
4. wallet ledger and Stripe funding
5. search and inspect
6. quote and purchase flow (sync execution)
7. USDC payout rail via Bridge or Circle
8. provider onboarding flow (submit URL + docs + auth + wallet)
9. approval and policy engine
10. subscriptions and async execution (v1.1)

## 17. Phased roadmap

### Phase 0: Design and validation

- validate [provider-manifest-spec.md](./provider-manifest-spec.md) against pilot providers
- define agent integration API
- validate [wallet-settlement-model.md](./wallet-settlement-model.md) against pilot billing scenarios
- define action state machine
- define policy model
- define billing events
- interview API providers and pilot users

### Phase 1: Marketplace foundation

- auth
- wallet funding and balance checks
- search and inspect APIs
- quote / buy / subscribe flow
- approval prompts
- basic result delivery and status tracking

### Phase 2: Marketplace alpha

- provider onboarding portal
- product publishing flow
- manifest ingestion
- vetted provider search
- tool gateway
- execution logging

### Phase 3: Billing and trust

- Stripe billing
- Connect onboarding
- usage metering
- provider payout statements
- trust tiers and review tooling

### Phase 4: Async and scheduling

- webhook resume
- polling workers
- cron schedules
- email / SMS output

### Phase 5: First-party clients and broader marketplace

- web session UI
- first-party CLI expansion
- provider dashboards
- approval management UI
- richer analytics

## 18. Concrete technical recommendations

1. Use a normalized internal tool schema instead of exposing raw OpenAPI or provider prose directly to agents.
2. Build a policy engine outside the model loop.
3. Keep a durable execution state machine for long-running jobs.
4. Start with vetted providers, then layer in self-serve publishing with trust tiers.
5. Make the marketplace agent-agnostic and keep first-party runtimes on top of the same API.
6. Use Stripe Billing plus Connect for marketplace billing and payouts.
7. Treat spending money as a separate permission class with hard ceilings.
8. Make every approval reusable, scoped, and revocable.

## 19. Open questions to answer before implementation

1. What legal, tax, and compliance obligations follow from Tolty acting as merchant of record in target markets?
2. Which action categories are allowed in MVP: read-only, write, communications, commerce?
3. Will provider onboarding be invite-only first?
4. Do we allow providers to bring their own auth flow, or do we standardize around a small approved set?
5. How much of provider pricing is public to the agent and to the user?
6. Do we require all providers to support idempotency keys?
7. What is the refund standard for failed or low-quality executions?

## 20. Proposed immediate next steps

1. Set up backend project structure, database, and auth model.
2. Build the doc-ingestion agent: given a docs URL, extract endpoints, schemas, auth, pricing, and generate an internal product card.
3. Build the execution broker agent: given a product card and auth credentials, construct and execute a real API call and return normalized results.
4. Implement the wallet ledger and Stripe funding from [wallet-settlement-model.md](./wallet-settlement-model.md).
5. Implement provider onboarding flow: submit API URL, docs URL, auth, payout wallet address.
6. Implement USDC payout rail via Bridge or Circle.
7. Write the agent integration API for search, inspect, wallet, quote, buy, and result delivery.

## 21. External references used

- Stripe Connect docs: https://docs.stripe.com/connect
- Stripe marketplace guide: https://docs.stripe.com/connect/marketplace
- Stripe usage-based billing guide: https://docs.stripe.com/get-started/use-cases/usage-based-billing
- Stripe meter docs: https://docs.stripe.com/billing/subscriptions/usage-based/meters/create
