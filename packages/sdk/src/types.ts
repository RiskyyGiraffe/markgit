// ── Client Options ──────────────────────────────────────────────────────

export interface ToltyClientOptions {
  apiKey: string;
  baseUrl?: string;
}

// ── Shared ──────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: { code: string; message: string };
}

// ── Auth ────────────────────────────────────────────────────────────────

export interface CreateApiKeyRequest {
  label?: string;
  permissions?: string[];
  budgetLimitUsd?: string;
  expiresInDays?: number;
}

export interface ApiKey {
  id: string;
  key: string;
  keyPrefix: string;
  label: string | null;
  permissions: string[];
  expiresAt: string | null;
  createdAt: string;
}

// ── Wallet ──────────────────────────────────────────────────────────────

export interface WalletBalance {
  walletId: string;
  balance: string;
  heldAmount: string;
  available: string;
}

export interface FundWalletRequest {
  amountUsd: string;
  description?: string;
}

export interface FundWalletResponse {
  ledgerEntry: LedgerEntry;
  balance: WalletBalance;
}

export interface LedgerEntry {
  id: string;
  walletId: string;
  entryType: string;
  amountUsd: string;
  balanceAfterUsd: string;
  description: string | null;
  createdAt: string;
}

// ── Checkout ────────────────────────────────────────────────────────────

export interface CreateCheckoutRequest {
  amountUsd: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

// ── Search ──────────────────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  results: ProductSummary[];
  total: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  pricePerCallUsd: string;
  tags: string[];
  providerId: string;
}

// ── Products ────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  providerId: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  status: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  pricePerCallUsd: string;
  tags: string[];
  buyerCredentialConfigured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionConfig?: Record<string, unknown>;
  pricePerCallUsd: string;
  tags?: string[];
}

export interface ProviderProductListResponse {
  results: Product[];
  total: number;
}

// ── Quotes ──────────────────────────────────────────────────────────────

export interface CreateQuoteRequest {
  productId: string;
  walletId?: string;
}

export interface Quote {
  id: string;
  userId: string;
  productId: string;
  walletId: string;
  priceUsd: string;
  toltyFeeUsd: string;
  totalUsd: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

// ── Purchases ───────────────────────────────────────────────────────────

export interface CreatePurchaseRequest {
  productId: string;
  quoteId: string;
  input?: Record<string, unknown>;
}

export interface PurchaseResponse {
  purchase: {
    id: string;
    userId: string;
    productId: string;
    quoteId: string;
    holdId: string;
    walletId: string;
    executionId: string | null;
    status: string;
    totalUsd: string;
    createdAt: string;
    updatedAt: string;
  };
  executionId: string;
  execution: {
    status: string;
    output: Record<string, unknown> | null;
    errorMessage: string | null;
  };
}

// ── Executions ──────────────────────────────────────────────────────────

export interface Execution {
  id: string;
  purchaseId: string;
  productId: string;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ExecutionResult {
  status: string;
  output: Record<string, unknown> | null;
  errorMessage?: string | null;
  completedAt?: string | null;
}

// ── List Responses ──────────────────────────────────────────────────

export interface ProductListResponse {
  results: ProductSummary[];
  total: number;
}

export interface PurchaseListItem {
  id: string;
  productId: string;
  productName: string;
  status: string;
  totalUsd: string;
  executionId: string | null;
  createdAt: string;
}

export interface PurchaseListResponse {
  results: PurchaseListItem[];
  total: number;
}

export interface ExecutionListItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName: string;
  status: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ExecutionListResponse {
  results: ExecutionListItem[];
  total: number;
}

export interface LedgerListResponse {
  entries: LedgerEntry[];
  total: number;
}

// ── Providers ───────────────────────────────────────────────────────────

export interface RegisterProviderRequest {
  name: string;
  description?: string;
  websiteUrl?: string;
}

export interface Provider {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  trustTier: string;
  createdAt: string;
  updatedAt: string;
}

// ── Stripe Connect ─────────────────────────────────────────────────────

export interface ConnectAccountRequest {
  refreshUrl: string;
  returnUrl: string;
}

export interface ConnectAccountResponse {
  url: string;
}

export interface StripeStatusResponse {
  accountId: string | null;
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  currentlyDue: string[];
  platformAvailableUsd: string;
  platformPendingUsd: string;
}

export interface StripeDashboardLinkResponse {
  url: string;
}

export interface EarningsSummary {
  totalGross: string;
  totalFees: string;
  totalNet: string;
  unpaid: string;
  paidOut: string;
}

export interface Payout {
  id: string;
  providerId: string;
  amountUsd: string;
  status: string;
  stripeTransferId: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  lastAttemptAt?: string | null;
  retryCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutResponse extends Payout {}

export interface PayoutListResponse {
  results: Payout[];
}

export interface EarningEntry {
  id: string;
  purchaseId: string;
  productName: string;
  grossAmountUsd: string;
  toltyFeeUsd: string;
  netAmountUsd: string;
  payoutId: string | null;
  createdAt: string;
}

export interface EarningListResponse {
  results: EarningEntry[];
  total: number;
}

export interface ProviderImportRun {
  id: string;
  providerId: string;
  docsUrl: string;
  baseUrl: string;
  sourceType: string;
  status: string;
  confidence: string;
  warnings: string[];
  errors: string[];
  generatedDraft: Record<string, unknown> | null;
  lastTestRequest: Record<string, unknown> | null;
  lastTestResponse: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderImportListResponse {
  results: ProviderImportRun[];
  total: number;
}

export interface CreateProviderImportRequest {
  docsUrl: string;
  baseUrl: string;
  authMode: 'none' | 'provider_managed' | 'buyer_supplied';
}

export interface ReviewProviderImportRequest {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  pricePerCallUsd?: string;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionConfig?: Record<string, unknown>;
}

export interface TestProviderImportRequest {
  input?: Record<string, unknown>;
  credential?: {
    value: string;
    authType: 'bearer' | 'api_key' | 'basic';
    location: 'header' | 'query' | 'body';
    name: string;
    scheme?: string;
  };
}

export interface PublishProviderImportRequest {
  draft?: ReviewProviderImportRequest;
  providerCredential?: {
    value: string;
    authType: 'bearer' | 'api_key' | 'basic';
    location: 'header' | 'query' | 'body';
    name: string;
    scheme?: string;
  };
}

export interface ImportTestResponse {
  run: ProviderImportRun;
  result: {
    success: boolean;
    output: Record<string, unknown> | null;
    errorMessage: string | null;
  };
}

export interface PublishProviderImportResponse {
  run: ProviderImportRun;
  product: Product;
}

export interface CredentialRequest {
  authType: 'bearer' | 'api_key' | 'basic';
  location: 'header' | 'query' | 'body';
  name: string;
  value: string;
}
