import type {
  MarkgitClientOptions,
  ApiErrorResponse,
  CreateApiKeyRequest,
  ApiKey,
  WalletBalance,
  FundWalletRequest,
  FundWalletResponse,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  SearchRequest,
  SearchResponse,
  Product,
  CreateProductRequest,
  ProviderProductListResponse,
  CreateQuoteRequest,
  Quote,
  CreatePurchaseRequest,
  PurchaseResponse,
  Execution,
  ExecutionResult,
  RegisterProviderRequest,
  Provider,
  ProductListResponse,
  PurchaseListResponse,
  ExecutionListResponse,
  LedgerListResponse,
  ConnectAccountResponse,
  StripeStatusResponse,
  StripeDashboardLinkResponse,
  EarningsSummary,
  EarningListResponse,
  PayoutResponse,
  PayoutListResponse,
  ProviderImportRun,
  ProviderImportListResponse,
  CreateProviderImportRequest,
  ReviewProviderImportRequest,
  TestProviderImportRequest,
  PublishProviderImportRequest,
  ImportTestResponse,
  PublishProviderImportResponse,
  CredentialRequest,
  ToolCard,
  ToolListResponse,
  ToolCallResponse,
  ToolQuoteResponse,
  ToolDocumentation,
  HarnessCard,
  HarnessListResponse,
  HarnessRun,
  HarnessRunEvent,
  HarnessDocumentation,
  HarnessManifest,
  PublishHarnessResponse,
  McpCard,
  McpListResponse,
  McpDocumentation,
  McpManifest,
  PublishMcpResponse,
  OriginVerificationChallenge,
  AuthorizationMode,
  QuicklistResponse,
  SkillCard,
  SkillListResponse,
  SkillDocumentation,
  SkillManifest,
  PublishSkillResponse,
} from './types.js';

export class MarkgitApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details: Omit<ApiErrorResponse['error'], 'code' | 'message'> = {},
  ) {
    super(message);
    this.name = 'MarkgitApiError';
  }
}

export class MarkgitClient {
  private baseUrl: string;
  private apiKey: string;
  private sessionId: string | null = null;

  constructor(options: MarkgitClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  // ── Auth ────────────────────────────────────────────────────────────

  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKey> {
    return this.request('POST', '/v1/auth/keys', request);
  }

  // ── Wallet ──────────────────────────────────────────────────────────

  async getWallet(): Promise<WalletBalance> {
    return this.request('GET', '/v1/wallet');
  }

  async fundWallet(request: FundWalletRequest): Promise<FundWalletResponse> {
    return this.request('POST', '/v1/wallet/fund', request);
  }

  async createCheckoutSession(request: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    return this.request('POST', '/v1/wallet/fund/checkout', request);
  }

  async getLedger(limit?: number, offset?: number): Promise<LedgerListResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return this.request('GET', `/v1/wallet/ledger${qs ? `?${qs}` : ''}`);
  }

  // ── Agent quicklist ────────────────────────────────────────────────

  async getQuicklist(): Promise<QuicklistResponse> {
    return this.request('GET', '/v1/quicklist');
  }

  async saveQuicklistTool(identifier: string, authorizationMode: AuthorizationMode = 'ask_paid') {
    return this.request('PUT', `/v1/quicklist/${encodeURIComponent(identifier)}`, { authorizationMode });
  }

  async removeQuicklistTool(identifier: string) {
    return this.request('DELETE', `/v1/quicklist/${encodeURIComponent(identifier)}`);
  }

  // ── Search ──────────────────────────────────────────────────────────

  async search(request: SearchRequest): Promise<SearchResponse> {
    return this.request('POST', '/v1/search', request);
  }

  async listTools(query = '', limit = 20, offset = 0): Promise<ToolListResponse> {
    const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
    return this.request('GET', `/v1/registry/tools?${params}`);
  }

  async getTool(identifier: string): Promise<ToolCard> {
    return this.request('GET', `/v1/registry/tools/${encodeURIComponent(identifier)}`);
  }

  async getToolDocumentation(identifier: string): Promise<ToolDocumentation> {
    return this.request('GET', `/v1/registry/tools/${encodeURIComponent(identifier)}/docs`);
  }

  async quoteTool(identifier: string): Promise<ToolQuoteResponse> {
    return this.request('POST', `/v1/tools/${encodeURIComponent(identifier)}/quote`, {});
  }

  async callTool(
    identifier: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
    quoteId: string,
    approvalManifestDigest?: string,
  ): Promise<ToolCallResponse> {
    return this.request(
      'POST',
      `/v1/tools/${encodeURIComponent(identifier)}/call`,
      {
        input,
        quoteId,
        ...(approvalManifestDigest
          ? { approval: { manifestDigest: approvalManifestDigest } }
          : {}),
      },
      { 'Idempotency-Key': idempotencyKey },
    );
  }

  // ── Harnesses ──────────────────────────────────────────────────────

  async listHarnesses(query = '', limit = 20, offset = 0): Promise<HarnessListResponse> {
    const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
    return this.request('GET', `/v1/registry/harnesses?${params}`);
  }

  async publishHarness(manifest: HarnessManifest): Promise<PublishHarnessResponse> {
    return this.request('POST', '/v1/harnesses', manifest);
  }

  async getHarness(identifier: string): Promise<HarnessCard> {
    return this.request('GET', `/v1/registry/harnesses/${encodeURIComponent(identifier)}`);
  }

  async getHarnessDocumentation(identifier: string): Promise<HarnessDocumentation> {
    return this.request('GET', `/v1/registry/harnesses/${encodeURIComponent(identifier)}/docs`);
  }

  async startHarness(
    identifier: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
    approvalManifestDigest?: string,
  ): Promise<HarnessRun> {
    return this.request('POST', `/v1/harnesses/${encodeURIComponent(identifier)}/runs`, {
      input,
      ...(approvalManifestDigest ? { approval: { manifestDigest: approvalManifestDigest } } : {}),
    }, { 'Idempotency-Key': idempotencyKey });
  }

  async getHarnessRun(runId: string): Promise<HarnessRun> {
    return this.request('GET', `/v1/harness-runs/${encodeURIComponent(runId)}`);
  }

  async listHarnessRunEvents(runId: string, after = 0, limit = 200): Promise<{
    runId: string;
    events: HarnessRunEvent[];
    nextAfter: number;
  }> {
    const params = new URLSearchParams({ after: String(after), limit: String(limit) });
    return this.request('GET', `/v1/harness-runs/${encodeURIComponent(runId)}/events?${params}`);
  }

  async cancelHarnessRun(runId: string): Promise<HarnessRun> {
    return this.request('POST', `/v1/harness-runs/${encodeURIComponent(runId)}/cancel`, {});
  }

  // ── MCP servers ───────────────────────────────────────────────────

  async listMcps(query = '', limit = 20, offset = 0): Promise<McpListResponse> {
    const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
    return this.request('GET', `/v1/registry/mcps?${params}`);
  }

  async publishMcp(manifest: McpManifest): Promise<PublishMcpResponse> {
    return this.request('POST', '/v1/mcps', manifest);
  }

  async getMcp(identifier: string): Promise<McpCard> {
    return this.request('GET', `/v1/registry/mcps/${encodeURIComponent(identifier)}`);
  }

  async getMcpDocumentation(identifier: string): Promise<McpDocumentation> {
    return this.request('GET', `/v1/registry/mcps/${encodeURIComponent(identifier)}/docs`);
  }

  // ── Agent skills ──────────────────────────────────────────────────

  async listSkills(query = '', limit = 20, offset = 0): Promise<SkillListResponse> {
    const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
    return this.request('GET', `/v1/registry/skills?${params}`);
  }

  async publishSkill(manifest: SkillManifest): Promise<PublishSkillResponse> {
    return this.request('POST', '/v1/skills', manifest);
  }

  async getSkill(identifier: string): Promise<SkillCard> {
    return this.request('GET', `/v1/registry/skills/${encodeURIComponent(identifier)}`);
  }

  async getSkillDocumentation(identifier: string): Promise<SkillDocumentation> {
    return this.request('GET', `/v1/registry/skills/${encodeURIComponent(identifier)}/docs`);
  }

  // ── Products ────────────────────────────────────────────────────────

  async listProducts(limit?: number, offset?: number): Promise<ProductListResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return this.request('GET', `/v1/products${qs ? `?${qs}` : ''}`);
  }

  async getProduct(id: string): Promise<Product> {
    return this.request('GET', `/v1/products/${id}`);
  }

  async createProduct(request: CreateProductRequest): Promise<Product> {
    return this.request('POST', '/v1/products', request);
  }

  async listMyProducts(limit?: number, offset?: number): Promise<ProviderProductListResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return this.request('GET', `/v1/products/mine${qs ? `?${qs}` : ''}`);
  }

  async submitProduct(id: string): Promise<Product> {
    return this.request('POST', `/v1/products/${id}/submit`);
  }

  async publishProduct(id: string): Promise<Product> {
    return this.request('POST', `/v1/products/${id}/publish`);
  }

  async setProviderCredential(id: string, request: CredentialRequest): Promise<{ id: string }> {
    return this.request('PUT', `/v1/products/${id}/credentials/provider`, request);
  }

  async setSelfCredential(id: string, request: CredentialRequest): Promise<{ id: string }> {
    return this.request('PUT', `/v1/products/${id}/credentials/self`, request);
  }

  async deleteSelfCredential(id: string): Promise<void> {
    await this.request('DELETE', `/v1/products/${id}/credentials/self`);
  }

  // ── Quotes ──────────────────────────────────────────────────────────

  async createQuote(request: CreateQuoteRequest): Promise<Quote> {
    return this.request('POST', '/v1/quotes', request);
  }

  // ── Purchases ───────────────────────────────────────────────────────

  async listPurchases(limit?: number, offset?: number): Promise<PurchaseListResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return this.request('GET', `/v1/purchases${qs ? `?${qs}` : ''}`);
  }

  async createPurchase(request: CreatePurchaseRequest): Promise<PurchaseResponse> {
    return this.request('POST', '/v1/purchases', request);
  }

  // ── Executions ──────────────────────────────────────────────────────

  async listExecutions(limit?: number, offset?: number): Promise<ExecutionListResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return this.request('GET', `/v1/executions${qs ? `?${qs}` : ''}`);
  }

  async getExecution(id: string): Promise<Execution> {
    return this.request('GET', `/v1/executions/${id}`);
  }

  async getExecutionResult(id: string): Promise<ExecutionResult> {
    return this.request('GET', `/v1/executions/${id}/result`);
  }

  // ── Providers ───────────────────────────────────────────────────────

  async registerProvider(request: RegisterProviderRequest): Promise<Provider> {
    return this.request('POST', '/v1/providers', request);
  }

  async getProvider(): Promise<Provider> {
    return this.request('GET', '/v1/providers');
  }

  async createOriginVerification(origin: string): Promise<OriginVerificationChallenge> {
    return this.request('POST', '/v1/providers/origin-verifications', { origin });
  }

  async verifyOrigin(id: string): Promise<{
    id: string;
    origin: string;
    status: 'verified';
    expiresAt: string;
  }> {
    return this.request('POST', `/v1/providers/origin-verifications/${id}/verify`);
  }

  // ── Stripe Connect ─────────────────────────────────────────────────

  async connectStripeAccount(request: { refreshUrl: string; returnUrl: string }): Promise<ConnectAccountResponse> {
    return this.request('POST', '/v1/providers/stripe/connect', request);
  }

  async getStripeStatus(): Promise<StripeStatusResponse> {
    return this.request('GET', '/v1/providers/stripe/status');
  }

  async syncStripeStatus(): Promise<StripeStatusResponse> {
    return this.request('POST', '/v1/providers/stripe/sync');
  }

  async getStripeDashboardLink(): Promise<StripeDashboardLinkResponse> {
    return this.request('GET', '/v1/providers/stripe/dashboard');
  }

  async getEarningsSummary(): Promise<EarningsSummary> {
    return this.request('GET', '/v1/providers/earnings');
  }

  async listEarnings(limit?: number, offset?: number): Promise<EarningListResponse> {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString();
    return this.request('GET', `/v1/providers/earnings/calls${qs ? `?${qs}` : ''}`);
  }

  async listPayouts(): Promise<PayoutListResponse> {
    return this.request('GET', '/v1/providers/payouts');
  }

  async listProviderImports(): Promise<ProviderImportListResponse> {
    return this.request('GET', '/v1/provider-imports');
  }

  async createProviderImport(request: CreateProviderImportRequest): Promise<ProviderImportRun> {
    return this.request('POST', '/v1/provider-imports', request);
  }

  async getProviderImport(id: string): Promise<ProviderImportRun> {
    return this.request('GET', `/v1/provider-imports/${id}`);
  }

  async reviewProviderImport(id: string, request: ReviewProviderImportRequest): Promise<ProviderImportRun> {
    return this.request('POST', `/v1/provider-imports/${id}/review`, request);
  }

  async testProviderImport(id: string, request: TestProviderImportRequest): Promise<ImportTestResponse> {
    return this.request('POST', `/v1/provider-imports/${id}/test`, request);
  }

  async publishProviderImport(
    id: string,
    request: PublishProviderImportRequest,
  ): Promise<PublishProviderImportResponse> {
    return this.request('POST', `/v1/provider-imports/${id}/publish`, request);
  }

  // ── Session ─────────────────────────────────────────────────────────

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }

  // ── Internal ────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (this.sessionId) {
      headers['X-Markgit-Session'] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Capture session ID from response
    const newSessionId = response.headers.get('X-Markgit-Session');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({
        error: { code: 'UNKNOWN', message: response.statusText },
      }))) as ApiErrorResponse;

      const { code, message, ...details } = errorBody.error;
      throw new MarkgitApiError(
        response.status,
        code,
        message,
        details,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
