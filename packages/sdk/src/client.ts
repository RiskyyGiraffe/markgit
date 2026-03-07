import type {
  ToltyClientOptions,
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
} from './types.js';

export class ToltyApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ToltyApiError';
  }
}

export class ToltyClient {
  private baseUrl: string;
  private apiKey: string;
  private sessionId: string | null = null;

  constructor(options: ToltyClientOptions) {
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

  // ── Search ──────────────────────────────────────────────────────────

  async search(request: SearchRequest): Promise<SearchResponse> {
    return this.request('POST', '/v1/search', request);
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

  // ── Stripe Connect ─────────────────────────────────────────────────

  async connectStripeAccount(request: { refreshUrl: string; returnUrl: string }): Promise<ConnectAccountResponse> {
    return this.request('POST', '/v1/providers/stripe/connect', request);
  }

  async getStripeStatus(): Promise<StripeStatusResponse> {
    return this.request('GET', '/v1/providers/stripe/status');
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

  // ── Session ─────────────────────────────────────────────────────────

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(id: string): void {
    this.sessionId = id;
  }

  // ── Internal ────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.sessionId) {
      headers['X-Tolty-Session'] = this.sessionId;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Capture session ID from response
    const newSessionId = response.headers.get('X-Tolty-Session');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({
        error: { code: 'UNKNOWN', message: response.statusText },
      }))) as ApiErrorResponse;

      throw new ToltyApiError(
        response.status,
        errorBody.error.code,
        errorBody.error.message,
      );
    }

    return response.json() as Promise<T>;
  }
}
