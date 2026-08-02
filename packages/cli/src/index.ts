#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';

const DEFAULT_API_URL = 'https://api.markgit.com';
const DEFAULT_WEB_URL = 'https://markgit.com';

type Config = {
  apiKey: string;
  apiUrl: string;
  webUrl: string;
};

type ApiError = { error?: { code?: string; message?: string } };

function configPath(): string {
  if (process.env.MARKGIT_CONFIG_DIR) return join(process.env.MARKGIT_CONFIG_DIR, 'config.json');
  if (platform() === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'markgit', 'config.json');
  }
  return join(homedir(), '.config', 'markgit', 'config.json');
}

async function loadConfig(required = true): Promise<Config | null> {
  try {
    const stored = JSON.parse(await readFile(configPath(), 'utf8')) as Config;
    return {
      ...stored,
      apiKey: process.env.MARKGIT_API_KEY ?? stored.apiKey,
      apiUrl: process.env.MARKGIT_API_URL ?? stored.apiUrl,
      webUrl: process.env.MARKGIT_WEB_URL ?? stored.webUrl,
    };
  } catch {
    if (process.env.MARKGIT_API_KEY) {
      return {
        apiKey: process.env.MARKGIT_API_KEY,
        apiUrl: process.env.MARKGIT_API_URL ?? DEFAULT_API_URL,
        webUrl: process.env.MARKGIT_WEB_URL ?? DEFAULT_WEB_URL,
      };
    }
    if (required) throw new Error('Not logged in. Run `markgit login` first.');
    return null;
  }
}

async function saveConfig(config: Config): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
}

async function request<T>(
  path: string,
  options: RequestInit & { apiUrl?: string; apiKey?: string } = {},
): Promise<T> {
  const apiUrl = (options.apiUrl ?? process.env.MARKGIT_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.apiKey) headers.set('Authorization', `Bearer ${options.apiKey}`);

  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) {
    const error = new Error(body.error?.message ?? `Request failed with HTTP ${response.status}`);
    Object.assign(error, { code: body.error?.code, status: response.status });
    throw error;
  }
  return body;
}

function openBrowser(url: string): boolean {
  const command = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform() === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function login(args: string[]): Promise<void> {
  const apiUrl = (process.env.MARKGIT_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
  const authorization = await request<{
    deviceCode: string;
    userCode: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
  }>('/v1/device/authorizations', {
    apiUrl,
    method: 'POST',
    body: JSON.stringify({ clientName: `Markgit CLI (${platform()})` }),
  });

  console.log(`\nLink this CLI with code: ${authorization.userCode}`);
  console.log(authorization.verificationUriComplete);
  if (!args.includes('--no-open')) openBrowser(authorization.verificationUriComplete);
  console.log('\nWaiting for approval…');

  const deadline = Date.now() + authorization.expiresIn * 1000;
  while (Date.now() < deadline) {
    await sleep(Math.max(authorization.interval, 1) * 1000);
    try {
      const token = await request<{ apiKey: string }>('/v1/device/token', {
        apiUrl,
        method: 'POST',
        body: JSON.stringify({ deviceCode: authorization.deviceCode }),
      });
      const webUrl = new URL(authorization.verificationUriComplete).origin;
      await saveConfig({ apiKey: token.apiKey, apiUrl, webUrl });
      console.log('Linked. Run `markgit balance` or `markgit search "weather"`.');
      return;
    } catch (error) {
      if ((error as { code?: string }).code === 'AUTHORIZATION_PENDING') continue;
      throw error;
    }
  }
  throw new Error('Login expired. Run `markgit login` to try again.');
}

async function status(): Promise<void> {
  const config = await loadConfig();
  const [identity, wallet] = await Promise.all([
    request<{ user: { email: string; name: string | null }; apiKey: { budget: { limitUsd: string | null; usedUsd: string } } }>(
      '/v1/auth/me', { apiUrl: config!.apiUrl, apiKey: config!.apiKey },
    ),
    request<{ available: string; heldAmount: string }>('/v1/wallet', {
      apiUrl: config!.apiUrl,
      apiKey: config!.apiKey,
    }),
  ]);
  console.log(identity.user.name ? `${identity.user.name} <${identity.user.email}>` : identity.user.email);
  console.log(`Available: $${wallet.available} USD`);
  if (parseFloat(wallet.heldAmount) > 0) console.log(`Held:      $${wallet.heldAmount} USD`);
  if (identity.apiKey.budget.limitUsd) {
    console.log(`Key spend:  $${identity.apiKey.budget.usedUsd} / $${identity.apiKey.budget.limitUsd} USD`);
  }
}

async function balance(): Promise<void> {
  const config = await loadConfig();
  const wallet = await request<{ balance: string; heldAmount: string; available: string }>('/v1/wallet', {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
  });
  console.log(`Available  $${wallet.available} USD`);
  console.log(`Held       $${wallet.heldAmount} USD`);
  console.log(`Balance    $${wallet.balance} USD`);
}

async function walletForAgent(): Promise<void> {
  const config = await loadConfig();
  const wallet = await request<{ available: string }>('/v1/wallet', {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
  });
  console.log(`$${Number.parseFloat(wallet.available).toFixed(4)} USD`);
}

type AuthorizationMode = 'ask_paid' | 'ask_every' | 'never_ask';

function authorizationMode(value: string | undefined): AuthorizationMode {
  const normalized = value?.toLowerCase().replaceAll('-', '_') ?? 'ask_paid';
  const aliases: Record<string, AuthorizationMode> = {
    paid: 'ask_paid',
    ask_paid: 'ask_paid',
    every: 'ask_every',
    ask_every: 'ask_every',
    never: 'never_ask',
    never_ask: 'never_ask',
  };
  const mode = aliases[normalized];
  if (!mode) throw new Error('Authorization must be paid, every, or never');
  return mode;
}

async function quicklist(args: string[]): Promise<void> {
  const config = await loadConfig();
  const [command, identifier, rawMode] = args;
  if (!command || command === 'list' || command === '--json') {
    const result = await request<{
      entries: Array<{
        tool: { slug: string; name: string; provider: { name: string }; pricing: { type: string; amount: string } };
        authorization: { mode: AuthorizationMode; label: string; versionCurrent: boolean };
      }>;
      total: number;
    }>('/v1/quicklist', { apiUrl: config!.apiUrl, apiKey: config!.apiKey });
    if (args.includes('--json') || command === '--json') {
      console.log(JSON.stringify(result.entries.map((entry) => entry.tool.slug)));
      return;
    }
    if (!result.entries.length) {
      console.log('Your agent quicklist is empty. Add one with `markgit quicklist add <tool-slug>`.');
      return;
    }
    for (const entry of result.entries) console.log(entry.tool.slug);
    console.log('\nRun `markgit <quicklist-name>` to see details.');
    return;
  }
  if (!identifier) throw new Error(`Usage: markgit quicklist ${command} <tool-slug>`);
  if (command === 'remove') {
    const result = await request<{ removed: boolean; tool: { slug: string } }>(`/v1/quicklist/${encodeURIComponent(identifier)}`, {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'DELETE',
    });
    console.log(`Removed ${result.tool.slug} from your agent quicklist.`);
    return;
  }
  if (command !== 'add' && command !== 'auth') throw new Error('Usage: markgit quicklist <list|add|auth|remove>');
  const mode = authorizationMode(valueAfter(args, '--authorization') ?? rawMode);
  const result = await request<{ tool: { slug: string; name: string } }>(`/v1/quicklist/${encodeURIComponent(identifier)}`, {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'PUT',
    body: JSON.stringify({ authorizationMode: mode }),
  });
  console.log(`${result.tool.name} is synced to your agent quicklist with authorization: ${mode}.`);
}

async function inspectQuicklistShortcut(identifier: string): Promise<boolean> {
  const config = await loadConfig(false);
  if (!config) return false;
  const result = await request<{
    entries: Array<{
      tool: { slug: string; name: string };
      authorization: { mode: AuthorizationMode; label: string; versionCurrent: boolean };
    }>;
  }>('/v1/quicklist', { apiUrl: config.apiUrl, apiKey: config.apiKey });
  const normalized = identifier.toLowerCase();
  const entry = result.entries.find((candidate) => (
    candidate.tool.slug === normalized
    || candidate.tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalized
  ));
  if (!entry) return false;
  const tool = await request<Record<string, unknown>>(`/v1/registry/tools/${encodeURIComponent(entry.tool.slug)}`, {
    apiUrl: config.apiUrl,
  });
  console.log(JSON.stringify({ tool, authorization: entry.authorization }, null, 2));
  return true;
}

async function search(args: string[]): Promise<void> {
  const kind = valueAfter(args, '--kind');
  if (kind && !['tool', 'harness', 'mcp', 'skill'].includes(kind)) {
    throw new Error('--kind must be tool, harness, mcp, or skill');
  }
  const limit = Math.min(100, Math.max(1, Number(valueAfter(args, '--limit') ?? 20)));
  const query = args.filter((arg, index) => {
    if (['--kind', '--limit'].includes(arg)) return false;
    if (index > 0 && ['--kind', '--limit'].includes(args[index - 1])) return false;
    return arg !== '--json';
  }).join(' ').trim();
  const apiUrl = (process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL);
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (kind) params.set('kind', kind);
  const result = await request<{ semantic: boolean; results: Array<{
    kind: 'tool' | 'harness' | 'mcp' | 'skill';
    slug: string;
    name: string;
    description: string | null;
    providerName: string;
    pricePerCallUsd: string;
    score: number;
    usage: { usageCount: number; uniqueUserCount: number };
    reviews: { helpfulPercent: number | null; total: number };
  }> }>(`/v1/registry/search?${params}`, { apiUrl });

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!result.results.length) {
    console.log('No matching registry items.');
    return;
  }
  for (const item of result.results) {
    const price = Number(item.pricePerCallUsd) === 0 ? 'free' : `$${item.pricePerCallUsd}/call`;
    const rating = item.reviews.total > 0 ? `${item.reviews.helpfulPercent}% helpful (${item.reviews.total})` : 'no reviews';
    console.log(`${item.kind.padEnd(7)} ${item.slug}  ${price}`);
    console.log(`  ${item.name} by ${item.providerName} · ${rating} · ${item.usage.usageCount} uses`);
    if (item.description) console.log(`  ${item.description}`);
  }
  console.log(`\nSearch mode: ${result.semantic ? 'semantic + full-document lexical' : 'full-document lexical fallback'}`);
}

async function inspect(identifier: string | undefined): Promise<void> {
  if (!identifier) throw new Error('Usage: markgit inspect <slug>');
  const apiUrl = (process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL);
  const item = await request<Record<string, unknown>>(`/v1/registry/items/${encodeURIComponent(identifier)}`, { apiUrl });
  console.log(JSON.stringify(item, null, 2));
}

async function listReviews(args: string[]): Promise<void> {
  const identifier = args[0];
  if (!identifier) throw new Error('Usage: markgit reviews <slug> [--json]');
  const apiUrl = process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL;
  const result = await request<{
    summary: { helpful: number; notHelpful: number; total: number; helpfulPercent: number | null };
    reviews: Array<{ helpful: boolean; agentName: string; title: string | null; body: string | null; verification: string; updatedAt: string }>;
  }>(`/v1/registry/items/${encodeURIComponent(identifier)}/reviews`, { apiUrl });
  if (args.includes('--json')) return void console.log(JSON.stringify(result, null, 2));
  console.log(result.summary.total ? `${result.summary.helpfulPercent}% helpful · ${result.summary.total} verified-use reviews` : 'No reviews yet.');
  for (const review of result.reviews) {
    console.log(`\n${review.helpful ? 'helpful' : 'not helpful'} · ${review.agentName} · ${review.verification}`);
    if (review.title) console.log(review.title);
    if (review.body) console.log(review.body);
  }
}

async function reportUsage(args: string[]): Promise<void> {
  const identifier = args[0];
  if (!identifier) throw new Error('Usage: markgit used <slug> [--agent codex] [--interaction id] [--summary text]');
  const config = await loadConfig();
  const result = await request<Record<string, unknown>>(`/v1/reviews/${encodeURIComponent(identifier)}/usage`, {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'POST',
    body: JSON.stringify({
      interactionId: valueAfter(args, '--interaction') ?? randomUUID(),
      agentName: valueAfter(args, '--agent') ?? 'markgit-cli-agent',
      evidenceSummary: valueAfter(args, '--summary'),
    }),
  });
  console.log(JSON.stringify(result, null, 2));
}

async function reviewItem(args: string[]): Promise<void> {
  const identifier = args[0];
  if (!identifier) throw new Error('Usage: markgit review <slug> --helpful|--not-helpful|--delete');
  const config = await loadConfig();
  if (args.includes('--delete')) {
    const result = await request<Record<string, unknown>>(`/v1/reviews/${encodeURIComponent(identifier)}`, {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'DELETE',
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!args.includes('--helpful') && !args.includes('--not-helpful')) {
    throw new Error('Usage: markgit review <slug> --helpful|--not-helpful [--agent name] [--title text] [--body text]');
  }
  const result = await request<Record<string, unknown>>(`/v1/reviews/${encodeURIComponent(identifier)}`, {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'PUT',
    body: JSON.stringify({
      helpful: args.includes('--helpful'),
      agentName: valueAfter(args, '--agent') ?? 'markgit-cli-agent',
      title: valueAfter(args, '--title'),
      body: valueAfter(args, '--body'),
    }),
  });
  console.log(JSON.stringify(result, null, 2));
}

async function searchHarnesses(args: string[]): Promise<void> {
  const query = args.join(' ').trim();
  const apiUrl = process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL;
  const result = await request<{ harnesses: Array<{
    slug: string;
    name: string;
    description: string | null;
    provider: { name: string };
    pricing: { type: 'free'; chargedByMarkgit: false; amount: string; externalApiCosts: string };
    usage: { runsLabel: string; usersLabel: string };
    access: { externalApis: unknown[]; markgitTools: unknown[]; data: unknown[] };
    compaction: { supported: boolean; strategy: string };
  }> }>(`/v1/registry/harnesses?q=${encodeURIComponent(query)}`, { apiUrl });
  if (!result.harnesses.length) {
    console.log('No matching harnesses.');
    return;
  }
  for (const harness of result.harnesses) {
    console.log(`${harness.slug}  free`);
    console.log(`  ${harness.name} by ${harness.provider.name} · ${harness.usage.runsLabel}`);
    console.log(`  access: ${harness.access.externalApis.length} external APIs, ${harness.access.markgitTools.length} tools, ${harness.access.data.length} data scopes · compaction ${harness.compaction.supported ? harness.compaction.strategy : 'not supported'}`);
    if (harness.description) console.log(`  ${harness.description}`);
  }
}

async function inspectHarness(identifier: string | undefined): Promise<void> {
  if (!identifier) throw new Error('Usage: markgit harness inspect <harness-slug>');
  const apiUrl = process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL;
  const harness = await request<Record<string, unknown>>(`/v1/registry/harnesses/${encodeURIComponent(identifier)}`, { apiUrl });
  console.log(JSON.stringify(harness, null, 2));
}

async function searchMcps(args: string[]): Promise<void> {
  const query = args.join(' ').trim();
  const apiUrl = process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL;
  const result = await request<{ mcps: Array<{
    slug: string;
    name: string;
    description: string | null;
    provider: { name: string };
    server: { transport: string; auth: { mode: string } };
    features: { tools: unknown[]; resources: boolean; prompts: boolean };
    trust: { endpoint: { status: string } };
  }> }>(`/v1/registry/mcps?q=${encodeURIComponent(query)}`, { apiUrl });
  if (!result.mcps.length) {
    console.log('No matching MCP servers.');
    return;
  }
  for (const mcp of result.mcps) {
    console.log(`${mcp.slug}  ${mcp.server.transport}  ${mcp.trust.endpoint.status}`);
    console.log(`  ${mcp.name} by ${mcp.provider.name} · ${mcp.features.tools.length} declared tools · auth ${mcp.server.auth.mode}`);
    if (mcp.description) console.log(`  ${mcp.description}`);
  }
}

async function inspectMcp(identifier: string | undefined): Promise<void> {
  if (!identifier) throw new Error('Usage: markgit mcp inspect <mcp-slug>');
  const apiUrl = process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL;
  const mcp = await request<Record<string, unknown>>(`/v1/registry/mcps/${encodeURIComponent(identifier)}`, { apiUrl });
  console.log(JSON.stringify(mcp, null, 2));
}

async function searchSkills(args: string[]): Promise<void> {
  const query = args.join(' ').trim();
  const apiUrl = process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL;
  const result = await request<{ skills: Array<{
    slug: string;
    name: string;
    description: string | null;
    compatibility: string[];
    provenance: { publisher: string | null; repository: string };
    contents: { scripts: boolean; references: boolean; assets: boolean };
  }> }>(`/v1/registry/skills?q=${encodeURIComponent(query)}`, { apiUrl });
  if (!result.skills.length) {
    console.log('No matching skills.');
    return;
  }
  for (const skill of result.skills) {
    console.log(`${skill.slug}  ${skill.compatibility.join(',')}`);
    console.log(`  ${skill.name} by ${skill.provenance.publisher ?? new URL(skill.provenance.repository).hostname} · free · source hosted`);
    if (skill.description) console.log(`  ${skill.description}`);
  }
}

async function inspectSkill(identifier: string | undefined): Promise<void> {
  if (!identifier) throw new Error('Usage: markgit skill inspect <skill-slug>');
  const apiUrl = process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL;
  const skill = await request<Record<string, unknown>>(`/v1/registry/skills/${encodeURIComponent(identifier)}`, { apiUrl });
  console.log(JSON.stringify(skill, null, 2));
}

async function runHarness(args: string[]): Promise<void> {
  const identifier = args[0];
  if (!identifier) throw new Error('Usage: markgit loop run <loop-slug> --input \'{"goal":"..."}\' [--yes]');
  const rawInput = valueAfter(args, '--input') ?? valueAfter(args, '--json') ?? '{}';
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(rawInput) as Record<string, unknown>;
  } catch {
    throw new Error('--input must be a valid JSON object');
  }
  const config = await loadConfig();
  const harness = await request<{
    slug: string;
    name: string;
    version: { manifestDigest: string | null };
    trust: { runtime: { status: 'verified' | 'unverified' } };
    policy: { callable: boolean; approval: { requirement: string }; reasons: string[] };
    pricing: { type: 'free'; chargedByMarkgit: false; amount: string; externalApiCosts: string; note: string | null };
    access: {
      externalApis: Array<{ id: string; name: string; purpose: string; pricing: Record<string, unknown> }>;
      markgitTools: Array<{ slug: string; purpose: string; maxCallsPerRun?: number; maxSpendUsdPerRun?: string }>;
      data: Array<{ id: string; access: string; scope: string; purpose: string }>;
      dataRetention: string;
    };
    loop: Record<string, unknown>;
    compaction: Record<string, unknown>;
    observability: { mode: string; limitation: string };
  }>(`/v1/registry/harnesses/${encodeURIComponent(identifier)}`, { apiUrl: config!.apiUrl });
  if (!harness.policy.callable) throw new Error(`Custom loop is not callable: ${harness.policy.reasons.join('; ')}`);
  if (harness.trust.runtime.status !== 'verified' && !args.includes('--allow-unverified')) {
    throw new Error('This custom-loop runtime is unverified. Inspect its full access manifest, then re-run with --allow-unverified if you accept the risk.');
  }
  console.log(`Custom loop: ${harness.name}`);
  console.log('Loop charge: Free. Only the declared atomic tool calls below can debit the wallet.');
  console.log(`External API costs: ${harness.pricing.externalApiCosts}${harness.pricing.note ? ` · ${harness.pricing.note}` : ''}`);
  console.log('Frozen loop access:');
  console.log(JSON.stringify(harness.access, null, 2));
  console.log(`Loop limits: ${JSON.stringify(harness.loop)}`);
  console.log(`Compaction: ${JSON.stringify(harness.compaction)}`);
  console.log(`Observability: ${harness.observability.mode} · ${harness.observability.limitation}`);
  const maximumWalletSpend = harness.access.markgitTools.reduce(
    (sum, tool) => sum + Number(tool.maxSpendUsdPerRun ?? 0),
    0,
  );
  console.log(`Maximum wallet spend: $${maximumWalletSpend.toFixed(4)} per run`);
  const requiresApproval = harness.access.markgitTools.length > 0
    || harness.policy.approval.requirement !== 'covered_by_user_policy';
  if (!args.includes('--yes') && requiresApproval) {
    console.log('Approval required. Review the frozen access and maximum wallet spend above, then re-run with --yes.');
    return;
  }
  const run = await request<Record<string, unknown>>(`/v1/harnesses/${encodeURIComponent(identifier)}/runs`, {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      input,
      ...(requiresApproval ? { approval: { manifestDigest: harness.version.manifestDigest } } : {}),
    }),
  });
  console.log(JSON.stringify(run, null, 2));
}

async function monitorHarness(args: string[]): Promise<void> {
  const runId = args[0];
  if (!runId) throw new Error('Usage: markgit harness monitor <run-id> [--follow]');
  const config = await loadConfig();
  if (!args.includes('--follow')) {
    const run = await request<Record<string, unknown>>(`/v1/harness-runs/${encodeURIComponent(runId)}`, {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey,
    });
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  let after = 0;
  while (true) {
    const result = await request<{
      events: Array<{ sequence: number; type: string; source: string; message: string | null; data: Record<string, unknown>; createdAt: string }>;
      nextAfter: number;
    }>(`/v1/harness-runs/${encodeURIComponent(runId)}/events?after=${after}`, {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey,
    });
    for (const event of result.events) console.log(JSON.stringify(event));
    after = result.nextAfter;
    const run = await request<{ status: string }>(`/v1/harness-runs/${encodeURIComponent(runId)}`, {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey,
    });
    if (['completed', 'failed', 'cancelled'].includes(run.status)) return;
    await sleep(2_000);
  }
}

async function cancelHarness(runId: string | undefined): Promise<void> {
  if (!runId) throw new Error('Usage: markgit harness cancel <run-id>');
  const config = await loadConfig();
  const run = await request<Record<string, unknown>>(`/v1/harness-runs/${encodeURIComponent(runId)}/cancel`, {
    apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST', body: JSON.stringify({}),
  });
  console.log(JSON.stringify(run, null, 2));
}

async function callTool(args: string[]): Promise<void> {
  const identifier = args[0];
  if (!identifier) throw new Error('Usage: markgit call <tool-slug> --input \'{"key":"value"}\'');
  const rawInput = valueAfter(args, '--input') ?? valueAfter(args, '--json') ?? '{}';
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(rawInput) as Record<string, unknown>;
  } catch {
    throw new Error('--input must be a valid JSON object');
  }

  const storedConfig = await loadConfig(false);
  const apiUrl = process.env.MARKGIT_API_URL ?? storedConfig?.apiUrl ?? DEFAULT_API_URL;
  const tool = await request<{
    id: string;
    slug: string;
    name: string;
    pricing: { type: 'free' | 'per_call'; amount: string; currency: 'USD' };
    access: {
      mode: 'direct' | 'gateway';
      endpoint: { url?: string; method: 'GET' | 'POST'; path?: string };
    };
    version: { manifestDigest: string | null };
    trust: { endpoint: { status: 'verified' | 'unverified' } };
    risk: { level: string };
    policy: {
      callable: boolean;
      eligibleForAutoCall: boolean;
      approval: { requirement: string; manifestDigest: string | null };
      reasons: string[];
    };
  }>(`/v1/registry/tools/${encodeURIComponent(identifier)}`, { apiUrl });

  if (!tool.policy.callable) {
    throw new Error(`Tool is not callable: ${tool.policy.reasons.join('; ')}`);
  }
  const unverified = tool.trust.endpoint.status !== 'verified';
  if (unverified && !args.includes('--allow-unverified')) {
    throw new Error(
      `This tool's endpoint is unverified. Inspect it first, then re-run with --allow-unverified if you accept the risk.`,
    );
  }

  if (tool.access.mode === 'direct' && tool.access.endpoint.url && !storedConfig) {
    const url = new URL(tool.access.endpoint.url);
    const options: RequestInit = {
      method: tool.access.endpoint.method,
      headers: { Accept: 'application/json' },
    };
    if (tool.access.endpoint.method === 'GET') {
      for (const [key, value] of Object.entries(input)) url.searchParams.set(key, String(value));
    } else {
      options.headers = { ...options.headers, 'Content-Type': 'application/json' };
      options.body = JSON.stringify(input);
    }
    const response = await fetch(url, options);
    const output = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Tool returned HTTP ${response.status}`);
    console.log(JSON.stringify({
      tool: { id: tool.id, slug: tool.slug, name: tool.name },
      status: 'completed',
      cost: { amount: '0.0000', currency: 'USD' },
      output,
      usageTracking: 'untracked direct call; run `markgit login` to include free calls in public usage metrics',
    }, null, 2));
    return;
  }

  const config = await loadConfig();
  const approval = await request<{
    quote: {
      id: string;
      priceUsd: string;
      feeUsd: string;
      totalUsd: string;
      expiresAt: string;
      manifestDigest: string | null;
    };
    policy: {
      callable: boolean;
      approval: { requirement: string; manifestDigest: string | null };
      reasons: string[];
      riskLevel: string;
    };
    controls: { approved: boolean; violations: string[] };
  }>(`/v1/tools/${encodeURIComponent(identifier)}/quote`, {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'POST',
    body: JSON.stringify({}),
  });

  const isFree = tool.pricing.type === 'free';
  console.log(isFree
    ? 'Price: Free · this successful call will count toward Markgit usage metrics'
    : `Price: $${approval.quote.priceUsd} + $${approval.quote.feeUsd} Markgit fee = $${approval.quote.totalUsd} USD`);
  console.log(`Trust: ${tool.trust.endpoint.status} endpoint · risk ${approval.policy.riskLevel} · approval ${approval.policy.approval.requirement}`);
  if (approval.policy.reasons.length > 0) {
    console.log(`Policy: ${approval.policy.reasons.join('; ')}`);
  }
  if (!approval.policy.callable) throw new Error('Tool policy blocks this call');
  if (!approval.controls.approved) {
    throw new Error(`Blocked by spend controls: ${approval.controls.violations.join('; ')}`);
  }

  const rawMaxCost = valueAfter(args, '--max-cost');
  if (rawMaxCost !== undefined) {
    const maxCost = Number.parseFloat(rawMaxCost);
    if (!Number.isFinite(maxCost) || maxCost < 0) throw new Error('--max-cost must be a non-negative USD amount');
    if (Number.parseFloat(approval.quote.totalUsd) > maxCost) {
      throw new Error(`Quoted cost $${approval.quote.totalUsd} exceeds --max-cost $${maxCost.toFixed(4)}`);
    }
  }

  const requiresUserApproval = !['covered_by_user_policy', 'explicit_unverified'].includes(
    approval.policy.approval.requirement,
  );
  if (requiresUserApproval && !args.includes('--yes') && rawMaxCost === undefined) {
    console.log(isFree
      ? 'Approval required by your synced authorization setting. Review the call and re-run with --yes.'
      : `Approval required by your synced authorization setting. Re-run with --yes or --max-cost ${approval.quote.totalUsd}.`);
    return;
  }

  const result = await request<Record<string, unknown>>(
    tool.access.endpoint.path ?? `/v1/tools/${encodeURIComponent(identifier)}/call`,
    {
      apiUrl: config!.apiUrl,
      apiKey: config!.apiKey,
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        input,
        quoteId: approval.quote.id,
        ...(approval.policy.approval.requirement === 'covered_by_user_policy'
          ? {}
          : { approval: { manifestDigest: approval.quote.manifestDigest } }),
      }),
    },
  );
  console.log(JSON.stringify(result, null, 2));
}

async function openWallet(): Promise<void> {
  const config = await loadConfig();
  const url = `${config!.webUrl.replace(/\/$/, '')}/wallet`;
  console.log(url);
  openBrowser(url);
}

async function fundWallet(args: string[]): Promise<void> {
  const amount = args[0];
  if (!amount) return openWallet();
  if (!/^\d+(?:\.\d{1,4})?$/.test(amount) || Number.parseFloat(amount) <= 0) {
    throw new Error('Usage: markgit fund <positive USD amount>');
  }
  const config = await loadConfig();
  const result = await request<{ balance: { balance: string; available: string } }>('/v1/wallet/fund', {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'POST',
    body: JSON.stringify({ amountUsd: Number.parseFloat(amount).toFixed(4), description: 'Local CLI test funding' }),
  });
  console.log(`Wallet funded. Available: $${result.balance.available} USD`);
}

async function earnings(): Promise<void> {
  const config = await loadConfig();
  const result = await request<{
    totalGross: string; totalFees: string; totalNet: string; unpaid: string; paidOut: string; nonPayable: string;
  }>('/v1/providers/earnings', { apiUrl: config!.apiUrl, apiKey: config!.apiKey });
  console.log(`Provider earnings: $${result.totalNet} USD`);
  console.log(`Unpaid:            $${result.unpaid} USD`);
  console.log(`Paid out:          $${result.paidOut} USD`);
  console.log(`Test/non-payable:  $${result.nonPayable} USD`);
  console.log('Cash-backed earnings become payout-eligible three days after the successful call.');
}

async function verifyOrigin(args: string[]): Promise<void> {
  const config = await loadConfig();
  if (args[0] === '--check') {
    const id = args[1];
    if (!id) throw new Error('Usage: markgit verify-origin --check <verification-id>');
    const result = await request<Record<string, unknown>>(
      `/v1/providers/origin-verifications/${encodeURIComponent(id)}/verify`,
      { apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST' },
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const origin = args[0];
  if (!origin) throw new Error('Usage: markgit verify-origin <https://tool-host.example>');
  const result = await request<{
    id: string;
    verificationUrl: string;
    expiresAt: string;
    file: Record<string, string>;
  }>('/v1/providers/origin-verifications', {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'POST',
    body: JSON.stringify({ origin }),
  });
  console.log(`Publish this JSON at ${result.verificationUrl}:`);
  console.log(JSON.stringify(result.file, null, 2));
  console.log(`Then run: markgit verify-origin --check ${result.id}`);
  console.log(`Challenge expires: ${result.expiresAt}`);
}

function controlUpdate(args: string[]) {
  const update: Record<string, string | number | boolean> = {};
  const mappings = [
    ['--per-call', 'maxPerCallUsd'],
    ['--daily', 'dailyLimitUsd'],
    ['--monthly', 'monthlyLimitUsd'],
  ] as const;
  for (const [flag, field] of mappings) {
    const value = valueAfter(args, flag);
    if (value !== undefined) update[field] = Number.parseFloat(value).toFixed(4);
  }
  const rpm = valueAfter(args, '--rpm');
  const rph = valueAfter(args, '--rph');
  if (rpm !== undefined) update.rateLimitPerMinute = Number.parseInt(rpm, 10);
  if (rph !== undefined) update.rateLimitPerHour = Number.parseInt(rph, 10);
  if (args.includes('--allow')) update.allowed = true;
  if (args.includes('--block')) update.allowed = false;
  return update;
}

async function limits(args: string[]): Promise<void> {
  const config = await loadConfig();
  if (args[0] === 'set') {
    const result = await request<Record<string, unknown>>('/v1/spend-controls', {
      apiUrl: config!.apiUrl,
      apiKey: config!.apiKey,
      method: 'PUT',
      body: JSON.stringify(controlUpdate(args.slice(1))),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (args[0] === 'tool') {
    const identifier = args[1];
    if (!identifier) throw new Error('Usage: markgit limits tool <tool-slug> [limits]');
    if (args.length === 2) {
      const result = await request<Record<string, unknown>>(`/v1/spend-controls/tools/${encodeURIComponent(identifier)}`, {
        apiUrl: config!.apiUrl,
        apiKey: config!.apiKey,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (args.includes('--inherit')) {
      const result = await request<Record<string, unknown>>(`/v1/spend-controls/tools/${encodeURIComponent(identifier)}`, {
        apiUrl: config!.apiUrl,
        apiKey: config!.apiKey,
        method: 'DELETE',
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const result = await request<Record<string, unknown>>(`/v1/spend-controls/tools/${encodeURIComponent(identifier)}`, {
      apiUrl: config!.apiUrl,
      apiKey: config!.apiKey,
      method: 'PUT',
      body: JSON.stringify(controlUpdate(args.slice(2))),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const result = await request<Record<string, unknown>>('/v1/spend-controls', {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
  });
  console.log(JSON.stringify(result, null, 2));
}

type PublishManifest = {
  provider?: { name: string; description?: string; websiteUrl?: string };
  [key: string]: unknown;
};

async function publish(args: string[], activate = false): Promise<void> {
  const manifestPath = args[0];
  if (!manifestPath) throw new Error('Usage: markgit publish <markgit-tool.json>');
  const config = await loadConfig();
  let manifest: PublishManifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PublishManifest;
  } catch (error) {
    throw new Error(`Could not read manifest: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await request('/v1/providers', { apiUrl: config!.apiUrl, apiKey: config!.apiKey });
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    await request('/v1/providers', {
      apiUrl: config!.apiUrl,
      apiKey: config!.apiKey,
      method: 'POST',
      body: JSON.stringify(manifest.provider ?? { name: 'Local Markgit Provider' }),
    });
    console.log(`Registered provider: ${manifest.provider?.name ?? 'Local Markgit Provider'}`);
  }

  const result = await request<{ tool: { id: string; slug: string; status: string }; created: boolean }>('/v1/tools', {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'POST',
    body: JSON.stringify(manifest),
  });
  const shouldActivate = activate || args.includes('--activate');
  if (shouldActivate) {
    if (result.tool.status === 'draft') {
      await request(`/v1/products/${result.tool.id}/submit`, {
        apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST',
      });
    }
    if (result.tool.status === 'draft' || result.tool.status === 'pending_review') {
      await request(`/v1/products/${result.tool.id}/publish`, {
        apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST',
      });
    }
  }
  console.log(JSON.stringify({ ...result, status: shouldActivate ? 'active' : result.tool.status }, null, 2));
}

async function publishHarness(args: string[], activate = false): Promise<void> {
  const manifestPath = args[0];
  if (!manifestPath) throw new Error('Usage: markgit harness publish <markgit-harness.json>');
  const config = await loadConfig();
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PublishManifest;
  try {
    await request('/v1/providers', { apiUrl: config!.apiUrl, apiKey: config!.apiKey });
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    await request('/v1/providers', {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST',
      body: JSON.stringify(manifest.provider ?? { name: 'Local Markgit Provider' }),
    });
  }
  const result = await request<{ harness: { id: string; slug: string; status: string }; created: boolean }>('/v1/harnesses', {
    apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST', body: JSON.stringify(manifest),
  });
  if (activate) {
    if (result.harness.status === 'draft') await request(`/v1/products/${result.harness.id}/submit`, { apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST' });
    if (['draft', 'pending_review'].includes(result.harness.status)) await request(`/v1/products/${result.harness.id}/publish`, { apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST' });
  }
  console.log(JSON.stringify({ ...result, status: activate ? 'active' : result.harness.status }, null, 2));
}

async function harnessCommand(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  switch (command) {
    case 'search': return searchHarnesses(rest);
    case 'inspect': return inspectHarness(rest[0]);
    case 'run': return runHarness(rest);
    case 'monitor': return monitorHarness(rest);
    case 'cancel': return cancelHarness(rest[0]);
    case 'publish': return publishHarness(rest);
    case 'onboard': return publishHarness(rest, true);
    default: throw new Error('Usage: markgit loop <search|inspect|run|monitor|cancel|publish|onboard>');
  }
}

async function publishMcp(args: string[], activate = false): Promise<void> {
  const manifestPath = args[0];
  if (!manifestPath) throw new Error('Usage: markgit mcp publish <markgit-mcp.json>');
  const config = await loadConfig();
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PublishManifest;
  try {
    await request('/v1/providers', { apiUrl: config!.apiUrl, apiKey: config!.apiKey });
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    await request('/v1/providers', {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST',
      body: JSON.stringify(manifest.provider ?? { name: 'Local Markgit Provider' }),
    });
  }
  const result = await request<{ mcp: { id: string; slug: string; status: string }; created: boolean }>('/v1/mcps', {
    apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST', body: JSON.stringify(manifest),
  });
  if (activate) {
    if (result.mcp.status === 'draft') await request(`/v1/products/${result.mcp.id}/submit`, { apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST' });
    if (['draft', 'pending_review'].includes(result.mcp.status)) await request(`/v1/products/${result.mcp.id}/publish`, { apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST' });
  }
  console.log(JSON.stringify({ ...result, status: activate ? 'active' : result.mcp.status }, null, 2));
}

async function mcpCommand(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  switch (command) {
    case 'search': return searchMcps(rest);
    case 'inspect': return inspectMcp(rest[0]);
    case 'publish': return publishMcp(rest);
    case 'onboard': return publishMcp(rest, true);
    default: throw new Error('Usage: markgit mcp <search|inspect|publish|onboard>');
  }
}

async function publishSkill(args: string[], activate = false): Promise<void> {
  const manifestPath = args[0];
  if (!manifestPath) throw new Error('Usage: markgit skill publish <markgit-skill.json>');
  const config = await loadConfig();
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PublishManifest;
  try {
    await request('/v1/providers', { apiUrl: config!.apiUrl, apiKey: config!.apiKey });
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    await request('/v1/providers', {
      apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST',
      body: JSON.stringify(manifest.provider ?? { name: 'Local Markgit Provider' }),
    });
  }
  const result = await request<{ skill: { id: string; slug: string; status: string }; created: boolean }>('/v1/skills', {
    apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST', body: JSON.stringify(manifest),
  });
  if (activate) {
    if (result.skill.status === 'draft') await request(`/v1/products/${result.skill.id}/submit`, { apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST' });
    if (['draft', 'pending_review'].includes(result.skill.status)) await request(`/v1/products/${result.skill.id}/publish`, { apiUrl: config!.apiUrl, apiKey: config!.apiKey, method: 'POST' });
  }
  console.log(JSON.stringify({ ...result, status: activate ? 'active' : result.skill.status }, null, 2));
}

async function skillCommand(args: string[]): Promise<void> {
  const [command, ...rest] = args;
  switch (command) {
    case 'search': return searchSkills(rest);
    case 'inspect': return inspectSkill(rest[0]);
    case 'publish': return publishSkill(rest);
    case 'onboard': return publishSkill(rest, true);
    default: throw new Error('Usage: markgit skill <search|inspect|publish|onboard>');
  }
}

function help(): void {
  console.log(`Markgit — a thin client for searchable, metered agent tools

Usage:
  markgit login                  Link this machine through your browser
  markgit logout                 Remove the account from this machine
  markgit status                 Show the linked account and available balance
  markgit balance                Show wallet balances
  markgit wallet                 Show the available wallet balance
  markgit quicklist [--json]     List tool names synced to this account
  markgit <quicklist-name>       Show details for a synced tool
  markgit quicklist add <slug> [paid|every|never]
  markgit quicklist auth <slug> <paid|every|never>
  markgit quicklist remove <slug>
  markgit fund [amount]          Fund locally by amount, or open the wallet portal
  markgit search [query] [--kind tool|harness|mcp|skill] [--json]
                                Semantically search every field of every registry item
  markgit inspect <slug>         Print any tool, loop, MCP, or skill including schemas
  markgit reviews <slug>         Read public verified-use agent reviews
  markgit used <slug>            Attest direct MCP/skill use before reviewing
  markgit review <slug> --helpful|--not-helpful|--delete [--title text] [--body text]
  markgit call <tool-slug> --input '{"key":"value"}' [--yes | --max-cost USD] [--allow-unverified]
  markgit publish <manifest>     Publish a provider-hosted tool as a draft
  markgit onboard <manifest>     Register provider, publish, and activate a tool
  markgit loop search [query]    Search provider-hosted custom agent loops
  markgit loop inspect <slug>    Show goal, access, budgets, limits, and compaction
  markgit loop run <slug> --input '{}' [--yes] [--allow-unverified]
  markgit loop monitor <id> [--follow]  Read the shared vendor-neutral event stream
  markgit loop cancel <id>       Request cancellation of a running loop
  markgit loop publish <file>    Publish a custom loop draft with explicit access
  markgit loop onboard <file>    Publish and activate a custom loop
  markgit mcp search [query]     Search provider-hosted MCP servers
  markgit mcp inspect <slug>     Show transport, auth, trust, and declared tools
  markgit mcp publish <file>     Publish an MCP server as a draft
  markgit mcp onboard <file>     Publish and activate an MCP server
  markgit skill search [query]   Search source-hosted agent skills
  markgit skill inspect <slug>   Show provenance and install guidance
  markgit skill publish <file>   Publish a skill listing as a draft
  markgit skill onboard <file>   Publish and activate a skill listing
  markgit limits                 Show global spend and rate controls
  markgit limits set [limits]    Set --per-call, --daily, --monthly, --rpm, --rph
  markgit limits tool <slug>     View/set limits; use --allow, --block, or --inherit
  markgit earnings               Show provider earnings
  markgit verify-origin <origin> Create an endpoint ownership challenge
  markgit verify-origin --check <id> Verify a published ownership challenge

Environment:
  MARKGIT_API_URL, MARKGIT_WEB_URL, MARKGIT_API_KEY`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  switch (command) {
    case 'login': return login(args);
    case 'logout':
      await rm(configPath(), { force: true });
      console.log('Logged out.');
      return;
    case 'status': return status();
    case 'balance': return balance();
    case 'wallet': return walletForAgent();
    case 'quicklist': return quicklist(args);
    case 'fund': return fundWallet(args);
    case 'search': return search(args);
    case 'inspect': return inspect(args[0]);
    case 'reviews': return listReviews(args);
    case 'used': return reportUsage(args);
    case 'review': return reviewItem(args);
    case 'call': return callTool(args);
    case 'publish': return publish(args);
    case 'onboard': return publish(args, true);
    case 'loop':
    case 'harness': return harnessCommand(args);
    case 'mcp': return mcpCommand(args);
    case 'skill': return skillCommand(args);
    case 'limits': return limits(args);
    case 'earnings': return earnings();
    case 'verify-origin': return verifyOrigin(args);
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      help();
      return;
    case '--version':
    case '-v':
      console.log('0.1.0');
      return;
    default:
      if (await inspectQuicklistShortcut(command)) return;
      throw new Error(`Unknown command: ${command}. Run \`markgit help\`.`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
