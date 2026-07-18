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

async function search(args: string[]): Promise<void> {
  const query = args.join(' ').trim();
  if (!query) throw new Error('Usage: markgit search <what you need>');
  const apiUrl = (process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL);
  const result = await request<{ tools: Array<{
    slug: string;
    name: string;
    description: string | null;
    provider: { name: string; trustTier: string };
    pricing: { type: string; amount: string; currency: string };
  }> }>(`/v1/registry/tools?q=${encodeURIComponent(query)}`, { apiUrl });

  if (!result.tools.length) {
    console.log('No matching tools.');
    return;
  }
  for (const tool of result.tools) {
    const price = tool.pricing.type === 'free' ? 'free' : `$${tool.pricing.amount}/call`;
    console.log(`${tool.slug}  ${price}`);
    console.log(`  ${tool.name} by ${tool.provider.name} · ${tool.provider.trustTier}`);
    if (tool.description) console.log(`  ${tool.description}`);
  }
}

async function inspect(identifier: string | undefined): Promise<void> {
  if (!identifier) throw new Error('Usage: markgit inspect <tool-slug>');
  const apiUrl = (process.env.MARKGIT_API_URL ?? (await loadConfig(false))?.apiUrl ?? DEFAULT_API_URL);
  const tool = await request<Record<string, unknown>>(`/v1/registry/tools/${encodeURIComponent(identifier)}`, { apiUrl });
  console.log(JSON.stringify(tool, null, 2));
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
  }>(`/v1/registry/tools/${encodeURIComponent(identifier)}`, { apiUrl });

  if (tool.access.mode === 'direct' && tool.access.endpoint.url) {
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
    }, null, 2));
    return;
  }

  const config = await loadConfig();
  const approval = await request<{
    quote: { id: string; priceUsd: string; feeUsd: string; totalUsd: string; expiresAt: string };
    controls: { approved: boolean; violations: string[] };
  }>(`/v1/tools/${encodeURIComponent(identifier)}/quote`, {
    apiUrl: config!.apiUrl,
    apiKey: config!.apiKey,
    method: 'POST',
    body: JSON.stringify({}),
  });

  console.log(`Price: $${approval.quote.priceUsd} + $${approval.quote.feeUsd} Markgit fee = $${approval.quote.totalUsd} USD`);
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
  } else if (!args.includes('--yes')) {
    console.log(`Approval required. Re-run with --yes or --max-cost ${approval.quote.totalUsd}.`);
    return;
  }

  const result = await request<Record<string, unknown>>(
    tool.access.endpoint.path ?? `/v1/tools/${encodeURIComponent(identifier)}/call`,
    {
      apiUrl: config!.apiUrl,
      apiKey: config!.apiKey,
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ input, quoteId: approval.quote.id }),
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
    totalGross: string; totalFees: string; totalNet: string; unpaid: string; paidOut: string;
  }>('/v1/providers/earnings', { apiUrl: config!.apiUrl, apiKey: config!.apiKey });
  console.log(`Provider earnings: $${result.totalNet} USD`);
  console.log(`Unpaid:            $${result.unpaid} USD`);
  console.log(`Paid out:          $${result.paidOut} USD`);
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

function help(): void {
  console.log(`Markgit — a thin client for searchable, metered agent tools

Usage:
  markgit login                  Link this machine through your browser
  markgit logout                 Remove the account from this machine
  markgit status                 Show the linked account and available balance
  markgit balance                Show wallet balances
  markgit fund [amount]          Fund locally by amount, or open the wallet portal
  markgit search <query>         Search the public tool registry
  markgit inspect <tool-slug>    Print a tool's schemas, provider, and price
  markgit call <tool-slug> --input '{"key":"value"}' [--yes | --max-cost USD]
  markgit publish <manifest>     Publish a provider-hosted tool as a draft
  markgit onboard <manifest>     Register provider, publish, and activate a tool
  markgit limits                 Show global spend and rate controls
  markgit limits set [limits]    Set --per-call, --daily, --monthly, --rpm, --rph
  markgit limits tool <slug>     View/set limits; use --allow, --block, or --inherit
  markgit earnings               Show provider earnings

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
    case 'fund': return fundWallet(args);
    case 'search': return search(args);
    case 'inspect': return inspect(args[0]);
    case 'call': return callTool(args);
    case 'publish': return publish(args);
    case 'onboard': return publish(args, true);
    case 'limits': return limits(args);
    case 'earnings': return earnings();
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
      throw new Error(`Unknown command: ${command}. Run \`markgit help\`.`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
