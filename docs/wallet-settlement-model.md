# Tolty Wallet, Quote, Purchase, and Settlement Model

## 1. Purpose

This spec defines how Tolty handles user spend, provider earnings, quote authorization, purchase execution, refunds, and payouts.

Tolty should use an internal wallet ledger even when Stripe is the payment processor. The wallet is the spend abstraction agents reason about; Stripe is one funding and payout rail behind it.

## 2. Design goals

1. Give agents a deterministic balance to check before spending.
2. Prevent providers from charging beyond an approved amount.
3. Keep wallet state, purchase state, and payout state auditable.
4. Support one-time purchases and recurring subscriptions with one accounting model.
5. Separate customer spend authorization from provider payout settlement.

## 3. Core entities

### 3.1 Wallet

A wallet belongs to a user or workspace.

Required fields:

- `wallet_id`
- `owner_type`
- `owner_id`
- `currency`
- `status`

Allowed `status` values:

- `active`
- `restricted`
- `suspended`
- `closed`

### 3.2 Ledger entry

Every wallet movement is a ledger entry.

Required fields:

- `ledger_entry_id`
- `wallet_id`
- `entry_type`
- `amount`
- `currency`
- `direction`
- `reference_type`
- `reference_id`
- `created_at`

Allowed `entry_type` values:

- `funding_credit`
- `funding_reversal`
- `hold_create`
- `hold_release`
- `charge_capture`
- `refund_credit`
- `adjustment`

Allowed `direction` values:

- `credit`
- `debit`

### 3.3 Quote

A quote is a priced offer for a product execution or subscription start.

Required fields:

- `quote_id`
- `product_id`
- `wallet_id`
- `pricing_type`
- `currency`
- `expires_at`
- `status`

Optional fields:

- `fixed_amount`
- `unit_rate`
- `estimated_amount`
- `not_to_exceed`
- `provider_quote_id`

Allowed `status` values:

- `created`
- `expired`
- `accepted`
- `canceled`

### 3.4 Purchase

A purchase is the user's accepted intent to spend wallet funds on a product.

Required fields:

- `purchase_id`
- `product_id`
- `wallet_id`
- `quote_id`
- `execution_id`
- `status`
- `approved_max_amount`
- `currency`

Allowed `status` values:

- `created`
- `awaiting_approval`
- `authorized`
- `running`
- `completed`
- `failed`
- `refunded`
- `canceled`

### 3.5 Hold

A hold reserves wallet funds before execution.

Required fields:

- `hold_id`
- `wallet_id`
- `quote_id`
- `purchase_id`
- `amount`
- `currency`
- `status`
- `expires_at`

Allowed `status` values:

- `active`
- `released`
- `captured`
- `expired`

### 3.6 Provider earning

Provider earning tracks the amount owed to a provider after execution settlement.

Required fields:

- `provider_earning_id`
- `provider_id`
- `purchase_id`
- `gross_amount`
- `tolty_fee_amount`
- `net_amount`
- `currency`
- `status`

Allowed `status` values:

- `pending`
- `held`
- `eligible_for_payout`
- `paid`
- `reversed`

### 3.7 Payout

A payout is a remittance from Tolty to a provider.

Required fields:

- `payout_id`
- `provider_id`
- `currency`
- `payout_method`
- `status`
- `period_start`
- `period_end`
- `net_amount`

Crypto payout fields (required when `payout_method` is `usdc`):

- `destination_wallet_address`
- `chain`
- `tx_hash`
- `block_confirmation_count`

Traditional payout fields (required when `payout_method` is `bank_transfer`):

- `stripe_transfer_id`

Allowed `payout_method` values:

- `usdc` (default)
- `bank_transfer` (opt-in via Stripe Connect)

Allowed `status` values:

- `scheduled`
- `in_transit`
- `confirmed` (on-chain confirmation received for crypto payouts)
- `paid`
- `failed`
- `reversed`

## 4. Wallet balances

Tolty should calculate these wallet views:

- `available_balance`
- `held_balance`
- `captured_spend`
- `pending_refund_balance`

Definitions:

- `available_balance` = funded credits - active holds - captured spend reversals not yet refunded
- `held_balance` = sum of active holds
- `captured_spend` = sum of settled charges
- `pending_refund_balance` = sum of approved but not yet credited refunds

Agents should see at least:

- `available_balance`
- `currency`
- active spending limits from policy

## 5. Funding model

V1 funding sources (inbound — user to Tolty):

- credit card via Stripe
- ACH via Stripe where available

Future funding adapters:

- stablecoin or crypto wallet funding
- invoice funding
- enterprise credit line

Funding flow:

1. user initiates wallet funding
2. Stripe confirms charge or transfer
3. Tolty writes `funding_credit`
4. wallet `available_balance` increases

Tolty should never let agents spend against processor events that have not been settled into the wallet ledger.

## 5.1 Payout model

V1 payout method (outbound — Tolty to provider):

- USDC stablecoin to provider-specified wallet address via Bridge (Stripe-owned) or Circle

Why USDC payouts:

- zero KYC friction at onboarding — provider just provides a wallet address
- instant global settlement with no currency conversion or SWIFT delays
- transaction fees are fractions of a cent on L2 chains (Base, Solana)
- fully auditable on-chain — every payout has a verifiable transaction hash
- eliminates Stripe Connect onboarding complexity for providers

Alternative payout rail:

- Stripe Connect for providers who require traditional bank deposits
- requires standard KYC, bank account linking, and adds processing time
- offered as opt-in, not the default

Recommended payout vendors:

- Bridge: stablecoin orchestration API, USD-to-USDC conversion, programmatic transfers (Stripe-owned)
- Circle: USDC issuer, programmable wallets and payout APIs

Payout flow:

1. purchase is captured and provider earning is created
2. earning enters `pending` status
3. after payout delay (7-14 days for new providers), earning moves to `eligible_for_payout`
4. Tolty batches eligible earnings on payout schedule
5. Tolty initiates USDC transfer to provider wallet address via Bridge or Circle
6. on-chain confirmation updates payout to `paid`
7. transaction hash is recorded in payout record

Tax and compliance:

- Tolty must still issue 1099s (US) or equivalent for providers above reporting thresholds
- provider KYC can be deferred until payout thresholds are reached
- crypto payouts do not exempt Tolty from tax reporting obligations

## 6. Quote model

Quotes exist so the agent can inspect price before committing wallet funds.

### 6.1 Quote types

- `fixed`
- `estimated`
- `not_to_exceed`

### 6.2 Quote rules

- every quote must have an expiration time
- every paid execution must link to a quote, even if the quote is internally generated for a fixed price
- quotes may include provider-originated ids, but Tolty quote ids are authoritative
- a quote may be reused only if still valid and explicitly allowed by policy

### 6.3 Quote response shape

Suggested fields:

- `quote_id`
- `product_id`
- `price_type`
- `currency`
- `estimated_amount`
- `not_to_exceed`
- `expires_at`
- `approval_required`
- `wallet_balance_snapshot`

## 7. Purchase flow

### 7.1 One-time purchase flow

1. agent calls `GET /v1/wallet`
2. agent calls `POST /v1/quotes`
3. Tolty evaluates policy and wallet sufficiency
4. if approval is required, purchase moves to `awaiting_approval`
5. once authorized, Tolty creates a hold
6. purchase moves to `authorized`
7. execution starts
8. purchase moves to `running`
9. on success, Tolty captures actual amount and releases unused hold
10. purchase moves to `completed`

### 7.2 Subscription purchase flow

1. agent requests a subscription quote or price preview
2. Tolty checks wallet and recurring-budget policy
3. Tolty authorizes initial hold or first-run charge
4. subscription is created
5. each run creates its own execution, hold, capture, and provider earning record

## 8. Settlement rules

### 8.1 Capture rules

Tolty should capture only the actual amount owed after execution completes.

Rules:

- actual amount must be less than or equal to `approved_max_amount`
- if actual amount is lower than held amount, release the remainder
- if actual amount exceeds hold amount, reject capture and mark execution for review unless a separate approval path exists

### 8.2 Provider earnings

Provider earning is created only after a purchase capture is successful.

Formula:

- `gross_amount` = captured amount
- `tolty_fee_amount` = Tolty marketplace fee
- `net_amount` = gross amount - tolty_fee_amount - reserves or dispute holds

### 8.3 Settlement timing

Recommended v1:

- wallet capture happens immediately after successful execution
- provider earning becomes `pending`
- new providers remain in `held` status until payout delay passes
- mature providers move to `eligible_for_payout` according to payout schedule

## 9. Refund model

Refund triggers:

- provider failure after capture
- duplicate execution
- partial delivery where policy allows partial refund
- manual dispute resolution

Refund flow:

1. refund is approved
2. purchase moves to `refunded` or partial-refund state in internal detail
3. wallet receives `refund_credit`
4. provider earning is reversed or reduced
5. if payout already occurred, provider balance is debited from future payouts or reserve

## 10. Failure handling

### 10.1 Provider failure before capture

- release hold
- mark purchase `failed`
- no provider earning created

### 10.2 Timeout with uncertain provider outcome

- keep purchase in review state internally
- do not capture above approved amount
- attempt reconciliation through status endpoint or provider callback
- auto-release hold only after reconciliation window expires

### 10.3 Provider attempts higher final charge

- reject settlement above approved max
- mark purchase for manual review
- require re-quote and new approval for any higher amount

## 11. Fraud and reserve model

Tolty should keep reserves separate from wallet balances.

Recommended provider controls:

- payout delay for new providers
- rolling reserve for risky categories
- provider risk score
- manual dispute review before releasing held earnings

## 12. API contract implications

Minimum billing-related endpoints:

- `GET /v1/wallet`
- `POST /v1/wallet/fund`
- `POST /v1/quotes`
- `POST /v1/purchases`
- `POST /v1/purchases/{id}/approve`
- `POST /v1/purchases/{id}/cancel`
- `POST /v1/purchases/{id}/refund`

Minimum response fields from `GET /v1/wallet`:

- `wallet_id`
- `currency`
- `available_balance`
- `held_balance`
- `policy_max_spend_per_task`
- `policy_max_spend_per_day`

## 13. CLI contract implications

Minimum commands:

- `tolty wallet balance`
- `tolty wallet fund --amount 100`
- `tolty products buy product_123 --max-price 25`
- `tolty purchases show purchase_123`
- `tolty purchases refund purchase_123`

CLI purchase output should show:

- quoted amount
- approved max amount
- wallet balance before purchase
- hold amount
- final captured amount
- provider used

## 14. Data model notes

Suggested core tables:

- `wallets`
- `wallet_ledger_entries`
- `quotes`
- `holds`
- `purchases`
- `executions`
- `provider_earnings`
- `payouts`
- `payout_transactions` (on-chain tx tracking for crypto payouts)
- `refunds`
- `provider_payout_configs` (wallet address, chain preference, payout method)

Every row should include:

- immutable primary id
- `created_at`
- `updated_at`
- `correlation_id`
- actor metadata where applicable

## 15. Example purchase timeline

Example:

1. wallet funded with `$100`
2. agent requests quote for a product with `not_to_exceed = $12`
3. Tolty creates a `$12` hold
4. execution completes with actual cost `$9.50`
5. Tolty captures `$9.50`
6. Tolty releases `$2.50`
7. Tolty records provider earning on `$9.50`

Wallet view after completion:

- available balance: `$90.50`
- held balance: `$0`

## 16. Implementation notes

The main plan in [tolty-product-plan.md](./tolty-product-plan.md) should treat this file as the authoritative contract for:

- wallet funding
- quote creation
- purchase authorization
- hold and capture logic
- provider earning calculation
- refunds and payouts
