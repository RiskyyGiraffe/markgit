// ── Client Options ──────────────────────────────────────────────────────

export interface MarkgitClientOptions {
  apiKey: string;
  baseUrl?: string;
}

// ── Shared ──────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requiredPermission?: string;
    approvalRequirement?: string;
    manifestDigest?: string | null;
    reasons?: string[];
    retryAfterSeconds?: number;
  };
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

export interface ToolCard {
  kind: 'tool';
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  provider: { id: string; name: string; trustTier: string };
  version: {
    number: number;
    manifestDigest: string | null;
    immutable: boolean;
  };
  trust: {
    provider: { tier: string; paymentVerified: boolean };
    endpoint: { status: 'verified' | 'unverified'; origin: string | null; verifiedAt: string | null };
    version: { status: 'versioned' | 'legacy_unversioned'; manifestDigest: string | null };
    behavior: { status: 'new' | 'established'; evidence: 'markgit_calls' };
  };
  risk: {
    level: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
    capabilities: ToolCapabilities;
  };
  policy: ToolPolicyDecision;
  usage: {
    count: number;
    uniqueUsers: number;
    tracked: true;
    coverage: 'markgit_calls';
    invocationsLabel: string;
    usersLabel: string;
  };
  pricing: { type: 'free' | 'per_call'; currency: 'USD'; amount: string };
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  access:
    | { mode: 'direct'; endpoint: { url: string; method: 'GET' | 'POST' } }
    | { mode: 'gateway'; endpoint: { path: string; method: 'POST' } };
  documentation: {
    json: string;
    openapi: string;
    llms: string;
    human: string;
  };
  updatedAt: string;
}

export interface ToolCapabilities {
  declared: boolean;
  readOnly: boolean;
  destructive: boolean;
  idempotent: boolean;
  openWorld: boolean;
  readsPrivateData: boolean;
  seesUntrustedContent: boolean;
  writesExternalData: boolean;
  sendsMessages: boolean;
  spendsMoney: boolean;
  executesCode: boolean;
  requiresUserCredential: boolean;
  allowedOutboundDomains: string[];
  dataRetention: 'none' | 'transient' | 'stored' | 'unknown';
}

export interface ToolPolicyDecision {
  callable: boolean;
  monetizationEligible: boolean;
  eligibleForAutoCall: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  approval: {
    requirement: 'covered_by_user_policy' | 'first_use' | 'per_call' | 'explicit_unverified' | 'blocked';
    manifestDigest: string | null;
  };
  reasons: string[];
  userAuthorization?: {
    mode: AuthorizationMode;
    label: string;
    versionCurrent: boolean;
  };
}

export type AuthorizationMode = 'ask_paid' | 'ask_every' | 'never_ask';

export interface QuicklistEntry {
  id: string;
  tool: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    description: string | null;
    category: string | null;
    tags: string[];
    provider: { id: string; name: string; trustTier: string };
    pricing: { type: 'free' | 'per_call'; amount: string; currency: 'USD' };
    manifestDigest: string | null;
  };
  authorization: {
    mode: AuthorizationMode;
    label: string;
    versionCurrent: boolean;
    manifestDigest: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface QuicklistResponse {
  entries: QuicklistEntry[];
  total: number;
}

export interface ToolDocumentation {
  schemaVersion: 'markgit.tool-docs/v1';
  tool: Omit<ToolCard, 'inputSchema' | 'outputSchema' | 'access' | 'documentation'>;
  documentation: {
    metadata: string;
    json: string;
    openapi: string;
    llms: string;
  };
  invocation: {
    flow: string[];
    quote: {
      method: 'POST';
      url: string;
      authentication: string;
      requestBody: Record<string, never>;
      responseSchema: Record<string, unknown>;
    };
    call: {
      method: 'POST';
      url: string;
      authentication: string;
      requiredHeaders: Record<string, string>;
      requestSchema: Record<string, unknown>;
      requestExample: Record<string, unknown>;
      responseSchema: Record<string, unknown>;
      responseExample: Record<string, unknown>;
    };
    direct: {
      note: string;
      method: 'GET' | 'POST';
      url: string;
      inputSchema: Record<string, unknown> | null;
      outputSchema: Record<string, unknown> | null;
    } | null;
  };
}

export interface ToolListResponse {
  tools: ToolCard[];
  total: number;
}

export interface ToolCallResponse {
  id: string;
  tool: { id: string; slug: string; name: string };
  status: string;
  cost: {
    priceUsd: string;
    feeUsd: string;
    totalUsd: string;
    currency: 'USD';
  };
  output: Record<string, unknown> | null;
  error: { message: string } | null;
}

export interface SpendControlPreview {
  approved: boolean;
  violations: string[];
  requestedUsd: string;
  global: Record<string, string | number | null>;
  tool: Record<string, string | number | boolean | null>;
}

export interface ToolQuoteResponse {
  quote: {
    id: string;
    priceUsd: string;
    feeUsd: string;
    totalUsd: string;
    expiresAt: string;
    manifestDigest: string | null;
  };
  tool: { id: string; slug: string; name: string };
  policy: ToolPolicyDecision;
  controls: SpendControlPreview;
}

// ── Harnesses ─────────────────────────────────────────────────────────

export interface HarnessExternalApi {
  id: string;
  name: string;
  baseUrl: string;
  purpose: string;
  dataSent: string[];
  dataReceived: string[];
  pricing: {
    type: 'free' | 'per_call' | 'passed_through' | 'unknown';
    amountUsd?: string;
    note?: string;
  };
}

export interface HarnessAccessManifest {
  externalApis: HarnessExternalApi[];
  markgitTools: Array<{ slug: string; purpose: string; maxCallsPerRun?: number }>;
  data: Array<{
    id: string;
    type: 'user_input' | 'filesystem' | 'database' | 'secret' | 'network' | 'other';
    access: 'read' | 'write' | 'read_write';
    purpose: string;
    scope: string;
  }>;
  dataRetention: 'none' | 'transient' | 'stored';
}

export interface HarnessManifest {
  schemaVersion: '1';
  kind: 'harness';
  name: string;
  slug: string;
  logoUrl?: string;
  description: string;
  category?: string;
  tags?: string[];
  provider?: { name: string; description?: string; websiteUrl?: string };
  runtime: { startUrl: string; cancelUrl?: string };
  inputSchema: Record<string, unknown> & { type: 'object' };
  outputSchema?: Record<string, unknown>;
  capabilities?: Partial<Omit<ToolCapabilities, 'declared'>>;
  access: HarnessAccessManifest;
  loop: { maxSteps: number; maxRuntimeSeconds: number; heartbeatSeconds: number };
  compaction: {
    supported: boolean;
    strategy: 'summary' | 'checkpoint' | 'provider_managed';
    maxContextTokens?: number;
    preserves: string[];
  };
  pricing: {
    externalApiCosts: 'included' | 'user_supplied';
    note?: string;
  };
}

export interface HarnessCard {
  kind: 'harness';
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  provider: { id: string; name: string; trustTier: string };
  version: ToolCard['version'];
  trust: {
    provider: { tier: string; paymentVerified: boolean };
    runtime: { status: 'verified' | 'unverified'; origin: string | null; verifiedAt: string | null };
    version: { status: 'versioned' | 'legacy_unversioned'; manifestDigest: string | null };
  };
  risk: ToolCard['risk'];
  policy: ToolPolicyDecision;
  pricing: {
    type: 'free';
    chargedByMarkgit: false;
    currency: 'USD';
    amount: string;
    externalApiCosts: 'included' | 'user_supplied';
    note: string | null;
    externalApis: Array<{ id: string; name: string; pricing: HarnessExternalApi['pricing'] }>;
  };
  usage: {
    runs: number;
    uniqueUsers: number;
    tracked: true;
    coverage: 'markgit_harness_runs';
    runsLabel: string;
    usersLabel: string;
  };
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  access: HarnessAccessManifest;
  loop: { maxSteps: number; maxRuntimeSeconds: number; heartbeatSeconds: number };
  compaction: {
    supported: boolean;
    strategy: 'summary' | 'checkpoint' | 'provider_managed';
    maxContextTokens?: number;
    preserves: string[];
  };
  invocation: Record<string, unknown>;
  observability: {
    mode: 'provider_attested';
    markgitEnforcesDeclaredEventReferences: true;
    limitation: string;
  };
  documentation: { json: string; openapi: string; llms: string; human: string };
  updatedAt: string;
}

export interface HarnessListResponse {
  harnesses: HarnessCard[];
  total: number;
}

export interface PublishHarnessResponse {
  harness: Product;
  created: boolean;
  next: string;
  transparency?: {
    access: HarnessAccessManifest;
    pricing: HarnessManifest['pricing'];
    compaction: HarnessManifest['compaction'];
  };
}

export interface HarnessRunEvent {
  id: string;
  runId: string;
  sequence: number;
  type: string;
  source: 'markgit' | 'provider' | 'user';
  message: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface HarnessRun {
  id: string;
  userId: string;
  apiKeyId: string;
  productId: string;
  quoteId: string | null;
  purchaseId: string | null;
  executionId: string | null;
  status: 'pending' | 'starting' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  providerRunId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  accessSnapshot: HarnessAccessManifest;
  pricingSnapshot: Record<string, unknown>;
  loopSnapshot: HarnessCard['loop'];
  compactionSnapshot: HarnessCard['compaction'];
  compactionCount: number;
  lastCompactedAt: string | null;
  lastHeartbeatAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  health: {
    status: 'healthy' | 'stale' | 'terminal';
    expectedHeartbeatSeconds: number;
    heartbeatAgeSeconds: number | null;
  };
  monitor: { method: 'GET'; path: string; eventsPath: string; authentication: string; vendorNeutral: true };
  events?: HarnessRunEvent[];
}

export interface HarnessDocumentation {
  schemaVersion: 'markgit.harness-docs/v1';
  harness: Omit<HarnessCard, 'inputSchema' | 'outputSchema' | 'invocation' | 'documentation'>;
  documentation: { metadata: string; json: string; openapi: string; llms: string };
  agentContract: Record<string, unknown>;
  providerContract: Record<string, unknown>;
}

// ── MCP servers ───────────────────────────────────────────────────────

export interface McpManifest {
  schemaVersion: '1';
  kind: 'mcp';
  name: string;
  slug: string;
  logoUrl?: string;
  description: string;
  category?: string;
  tags?: string[];
  provider?: { name: string; description?: string; websiteUrl?: string };
  source?: {
    publisher?: string;
    repositoryUrl: string;
    url: string;
    revision: string;
    path?: string;
    registryName?: string;
    registryVersion?: string;
    registryUrl?: string;
  };
  server: {
    url: string;
    transport: 'streamable_http' | 'sse';
    auth: { mode: 'none' | 'oauth2' | 'user_supplied'; instructionsUrl?: string };
  };
  features: {
    tools: Array<{ name: string; description?: string }>;
    resources: boolean;
    prompts: boolean;
  };
  capabilities?: Partial<Omit<ToolCapabilities, 'declared'>>;
}

export interface McpCard {
  kind: 'mcp';
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  provider: { id: string; name: string; trustTier: string };
  version: ToolCard['version'];
  trust: {
    provider: { tier: string };
    endpoint: { status: 'verified' | 'unverified'; origin: string };
  };
  risk: ToolCard['risk'];
  policy: ToolPolicyDecision;
  pricing: { type: 'free'; chargedByMarkgit: false; currency: 'USD'; amount: '0.0000' };
  server: McpManifest['server'];
  features: McpManifest['features'];
  source: McpManifest['source'] | null;
  sourceMetadata: PublicIndexedSourceMetadata | null;
  connect: {
    protocol: 'mcp';
    transport: McpManifest['server']['transport'];
    url: string;
    auth: McpManifest['server']['auth'];
    proxiedByMarkgit: false;
  };
  usage: { tracked: false; label: 'Source popularity' };
  documentation: { json: string; llms: string; review: string; human: string };
  updatedAt: string;
}

export interface McpListResponse {
  mcps: McpCard[];
  total: number;
}

export interface PublishMcpResponse {
  mcp: Product;
  created: boolean;
  next: string;
}

export interface McpDocumentation {
  schemaVersion: 'markgit.mcp-docs/v1';
  mcp: Record<string, unknown>;
  connection: McpCard['connect'] & { direct: true; note: string };
  documentation: { metadata: string; json: string; llms: string; review: string; human: string };
}

// ── Agent skills ─────────────────────────────────────────────────────

export type SkillCompatibility = 'agent-skills' | 'codex' | 'claude-code';

export interface PublicIndexedSourceMetadata {
  repository: { owner: string; name: string; url: string; revision: string; sourceUrl: string; updatedAt: string | null };
  review: { filename: string; path: string; rawUrl: string; sha256: string; available: boolean };
  popularity: { source: 'github'; stars: number };
  discovery: { source: 'official_mcp_registry' | 'publisher_repository'; registryName?: string; registryVersion?: string; registryUpdatedAt?: string; registryUrl?: string };
  refreshedAt: string;
}

export interface SkillManifest {
  schemaVersion: '1';
  kind: 'skill';
  name: string;
  slug: string;
  logoUrl?: string;
  description: string;
  category?: string;
  tags?: string[];
  provider?: { name: string; description?: string; websiteUrl?: string };
  source: {
    publisher?: string;
    repositoryUrl: string;
    url: string;
    path: string;
    revision: string;
    licenseUrl?: string;
  };
  compatibility: SkillCompatibility[];
  install?: { codex?: string; claudeCode?: string; universal?: string };
  contents?: { scripts?: boolean; references?: boolean; assets?: boolean };
}

export interface SkillCard {
  kind: 'skill';
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  provider: { id: string; name: string; trustTier: string };
  version: ToolCard['version'];
  format: 'agent-skills/v1';
  entrypoint: 'SKILL.md';
  source: SkillManifest['source'];
  compatibility: SkillCompatibility[];
  installation: {
    commands: NonNullable<SkillManifest['install']>;
    automatic: false;
    note: string;
  };
  contents: { scripts: boolean; references: boolean; assets: boolean };
  pricing: { type: 'free'; chargedByMarkgit: false; currency: 'USD'; amount: '0.0000' };
  provenance: { sourceHosted: true; indexedByMarkgit: true; publisher: string | null; repository: string; revision: string };
  sourceMetadata: PublicIndexedSourceMetadata | null;
  usage: { tracked: false; label: 'Source popularity' };
  documentation: { json: string; llms: string; review: string; human: string };
  updatedAt: string;
}

export interface SkillListResponse {
  skills: SkillCard[];
  total: number;
}

export interface PublishSkillResponse {
  skill: Product;
  created: boolean;
  next: string;
}

export interface SkillDocumentation {
  schemaVersion: 'markgit.skill-docs/v1';
  skill: SkillCard;
  safety: { sourceHosted: true; autoInstall: false; guidance: string };
  documentation: { metadata: string; json: string; llms: string; review: string; human: string; source: string };
}

export interface LeaderboardEntry {
  rank: number;
  kind: 'tool' | 'harness' | 'mcp' | 'skill';
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provider: string;
  logoUrl: string | null;
  value: number;
  metric: 'markgit_completed_calls' | 'markgit_completed_runs' | 'github_stars';
  metricLabel: string;
  sourceUrl: string | null;
  updatedAt: string;
}

export interface LeaderboardResponse {
  schemaVersion: 'markgit.leaderboard/v1';
  generatedAt: string;
  methodology: { separation: string; tools: string; harnesses: string; mcps: string; skills: string; tieBreak: string };
  categories: Record<'tools' | 'harnesses' | 'mcps' | 'skills', {
    metric: LeaderboardEntry['metric'];
    entries: LeaderboardEntry[];
  }>;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  pricePerCallUsd: string;
  tags: string[];
  providerId: string;
  usageCount: number;
  uniqueUserCount: number;
}

// ── Products ────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  providerId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  category: string | null;
  kind: 'tool' | 'harness' | 'mcp' | 'skill';
  status: string;
  moderationStatus: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionConfig: Record<string, unknown> | null;
  harnessConfig: Record<string, unknown> | null;
  mcpConfig: Record<string, unknown> | null;
  skillConfig: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown> | null;
  capabilities: ToolCapabilities | null;
  manifestDigest: string | null;
  currentVersion: number;
  pricePerCallUsd: string;
  tags: string[];
  buyerCredentialConfigured?: boolean;
  usageCount?: number;
  uniqueUserCount?: number;
  version?: ToolCard['version'];
  trust?: ToolCard['trust'];
  risk?: ToolCard['risk'];
  policy?: ToolPolicyDecision;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  category?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  capabilities?: Partial<Omit<ToolCapabilities, 'declared'>>;
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
  markgitFeeUsd: string;
  totalUsd: string;
  manifestDigest: string | null;
  policySnapshot: ToolPolicyDecision | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

// ── Purchases ───────────────────────────────────────────────────────────

export interface CreatePurchaseRequest {
  productId: string;
  quoteId: string;
  input?: Record<string, unknown>;
  approval?: { manifestDigest: string };
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
  verifiedOrigin: string | null;
  originVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OriginVerificationChallenge {
  id: string;
  origin: string;
  status: string;
  expiresAt: string;
  verificationUrl: string;
  file: { providerId: string; challenge: string };
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
  markgitFeeUsd: string;
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
  logoUrl?: string;
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
