import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import { products, providers, users } from './schema.js';
import {
  manifestMcpCapabilities,
  manifestMcpConfig,
  mcpExecutionConfig,
  validateMcpManifest,
  type McpAuthMode,
  type McpManifest,
} from '../lib/mcp-manifest.js';
import type { IndexedSourceMetadata } from '../lib/source-metadata.js';
import type { ToolCapabilities } from '../lib/tool-policy.js';
import { ensureProductVersion } from '../services/product-versions.js';

type CatalogMcp = {
  slug: string;
  name: string;
  publisher: string;
  repo: `${string}/${string}`;
  category: string;
  tags: string[];
  endpoint: string;
  auth: McpAuthMode;
  registryName?: string;
  description: string;
  capabilities: Partial<Omit<ToolCapabilities, 'declared'>>;
};

const catalog: CatalogMcp[] = [
  {
    slug: 'github-mcp', name: 'GitHub MCP Server', publisher: 'GitHub', repo: 'github/github-mcp-server',
    category: 'development', tags: ['github', 'repositories', 'issues', 'pull-requests'], endpoint: 'https://api.githubcopilot.com/mcp/', auth: 'user_supplied',
    description: 'GitHub’s official MCP server for repositories, code, issues, pull requests, Actions, and security workflows.',
    capabilities: { readOnly: false, destructive: true, openWorld: true, readsPrivateData: true, writesExternalData: true, sendsMessages: true, requiresUserCredential: true, dataRetention: 'unknown' },
  },
  {
    slug: 'sentry-mcp', name: 'Sentry MCP', publisher: 'Sentry', repo: 'getsentry/sentry-mcp',
    category: 'observability', tags: ['sentry', 'errors', 'traces', 'debugging'], endpoint: 'https://mcp.sentry.dev/mcp', auth: 'oauth2',
    description: 'Sentry’s MCP service for error monitoring, issue investigation, traces, releases, and debugging workflows.',
    capabilities: { readOnly: false, openWorld: true, readsPrivateData: true, writesExternalData: true, requiresUserCredential: true, dataRetention: 'unknown' },
  },
  {
    slug: 'stripe-mcp', name: 'Stripe MCP', publisher: 'Stripe', repo: 'stripe/agent-toolkit', registryName: 'com.stripe/mcp',
    category: 'payments', tags: ['stripe', 'payments', 'billing', 'commerce'], endpoint: 'https://mcp.stripe.com', auth: 'user_supplied',
    description: 'Stripe’s remote MCP server for payments, billing, customers, products, and related commerce workflows.',
    capabilities: { readOnly: false, destructive: true, openWorld: true, readsPrivateData: true, writesExternalData: true, spendsMoney: true, requiresUserCredential: true, dataRetention: 'unknown' },
  },
  {
    slug: 'cloudflare-docs-mcp', name: 'Cloudflare Documentation MCP', publisher: 'Cloudflare', repo: 'cloudflare/mcp-server-cloudflare', registryName: 'com.cloudflare.mcp/mcp',
    category: 'documentation', tags: ['cloudflare', 'documentation', 'workers', 'developer-tools'], endpoint: 'https://docs.mcp.cloudflare.com/mcp', auth: 'oauth2',
    description: 'Cloudflare’s documentation MCP server for current reference material across Workers and the Cloudflare platform.',
    capabilities: { readOnly: true, openWorld: true, seesUntrustedContent: true, requiresUserCredential: true, dataRetention: 'unknown' },
  },
  {
    slug: 'figma-mcp', name: 'Figma MCP Server', publisher: 'Figma', repo: 'figma/mcp-server-guide', registryName: 'com.figma.mcp/mcp',
    category: 'design', tags: ['figma', 'design', 'frontend', 'assets'], endpoint: 'https://mcp.figma.com/mcp', auth: 'oauth2',
    description: 'Figma’s remote MCP server for design context, screenshots, variables, assets, and supported editing workflows.',
    capabilities: { readOnly: false, openWorld: true, readsPrivateData: true, seesUntrustedContent: true, writesExternalData: true, requiresUserCredential: true, dataRetention: 'unknown' },
  },
];

const githubHeaders = { Accept: 'application/vnd.github+json', 'User-Agent': 'markgit-official-mcp-indexer' };

async function githubJson<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders });
  if (!response.ok) throw new Error(`GitHub ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

type RegistryEntry = {
  server: {
    name: string;
    version: string;
    description?: string;
    remotes?: Array<{ type: string; url: string }>;
    repository?: { url?: string; source?: string; subfolder?: string };
  };
  _meta?: { 'io.modelcontextprotocol.registry/official'?: { updatedAt?: string } };
};

async function officialRegistryEntry(name: string): Promise<RegistryEntry> {
  const response = await fetch(`https://registry.modelcontextprotocol.io/v0.1/servers?limit=100&version=latest&search=${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Official MCP Registry returned ${response.status}`);
  const payload = await response.json() as { servers?: RegistryEntry[] };
  const entry = payload.servers?.find((candidate) => candidate.server.name === name);
  if (!entry) throw new Error(`Official MCP Registry does not contain ${name}`);
  return entry;
}

async function providerFor(userId: string, source: CatalogMcp) {
  const name = `${source.publisher} MCP Index`;
  const [existing] = await db.select().from(providers).where(eq(providers.name, name)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(providers).values({
    userId,
    name,
    description: `Markgit index of the provider-hosted ${source.publisher} MCP server. ${source.publisher} does not operate this Markgit account.`,
    websiteUrl: `https://github.com/${source.repo}`,
    trustTier: 'basic',
  }).returning();
  return created;
}

async function main() {
  let [owner] = await db.select().from(users).where(eq(users.email, 'admin@markgit.dev')).limit(1);
  if (!owner) [owner] = await db.insert(users).values({ email: 'admin@markgit.dev', name: 'Markgit Registry' }).returning();

  for (const source of catalog) {
    const [repo, commit, registry] = await Promise.all([
      githubJson<{ default_branch: string; stargazers_count: number }>(`/repos/${source.repo}`),
      githubJson<{ sha: string; commit: { committer: { date: string | null } } }>(`/repos/${source.repo}/commits/HEAD`),
      source.registryName ? officialRegistryEntry(source.registryName) : Promise.resolve(null),
    ]);
    const revision = commit.sha;
    const readmePath = 'README.md';
    const rawUrl = `https://raw.githubusercontent.com/${source.repo}/${revision}/${readmePath}`;
    const readmeResponse = await fetch(rawUrl);
    if (!readmeResponse.ok) throw new Error(`${source.repo}/${readmePath} returned ${readmeResponse.status}`);
    const readme = await readmeResponse.text();
    if (registry && !registry.server.remotes?.some((remote) => remote.url.replace(/\/$/, '') === source.endpoint.replace(/\/$/, ''))) {
      throw new Error(`${source.endpoint} is no longer listed for ${source.registryName}`);
    }

    const sourceUrl = `https://github.com/${source.repo}/tree/${revision}`;
    const registryVersion = registry?.server.version;
    const registryUrl = source.registryName ? `https://registry.modelcontextprotocol.io/?q=${encodeURIComponent(source.registryName)}` : undefined;
    const manifest = validateMcpManifest({
      schemaVersion: '1',
      kind: 'mcp',
      name: source.name,
      slug: source.slug,
      description: registry?.server.description ?? source.description,
      category: source.category,
      tags: source.tags,
      server: {
        url: source.endpoint,
        transport: 'streamable_http',
        auth: { mode: source.auth, instructionsUrl: `https://github.com/${source.repo}` },
      },
      features: { tools: [], resources: false, prompts: false },
      capabilities: source.capabilities,
      source: {
        publisher: source.publisher,
        repositoryUrl: `https://github.com/${source.repo}`,
        url: sourceUrl,
        revision,
        ...(source.registryName ? { registryName: source.registryName, registryVersion, registryUrl } : {}),
      },
    } satisfies McpManifest);
    const provider = await providerFor(owner.id, source);
    const [existing] = await db.select().from(products).where(eq(products.slug, source.slug)).limit(1);
    if (existing && existing.kind !== 'mcp') throw new Error(`${source.slug} belongs to a ${existing.kind}`);
    const executionConfig = mcpExecutionConfig(manifest);
    const [repositoryOwner, repositoryName] = source.repo.split('/');
    const registryUpdatedAt = registry?._meta?.['io.modelcontextprotocol.registry/official']?.updatedAt;
    const sourceMetadata = {
      schemaVersion: 'markgit.indexed-source/v1',
      repository: {
        owner: repositoryOwner,
        name: repositoryName,
        url: `https://github.com/${source.repo}`,
        revision,
        sourceUrl,
        updatedAt: commit.commit.committer.date,
      },
      review: {
        filename: readmePath,
        path: readmePath,
        rawUrl,
        sha256: createHash('sha256').update(readme).digest('hex'),
        markdown: readme,
      },
      popularity: { source: 'github', stars: repo.stargazers_count },
      discovery: source.registryName
        ? { source: 'official_mcp_registry', registryName: source.registryName, registryVersion, registryUpdatedAt, registryUrl }
        : { source: 'publisher_repository' },
      refreshedAt: new Date().toISOString(),
    } satisfies IndexedSourceMetadata;
    const values = {
      providerId: provider.id,
      name: manifest.name,
      description: manifest.description,
      category: manifest.category,
      kind: 'mcp' as const,
      status: 'active' as const,
      pricePerCallUsd: '0.0000',
      tags: manifest.tags ?? [],
      executionConfig,
      mcpConfig: manifestMcpConfig(manifest) as unknown as Record<string, unknown>,
      sourceMetadata: sourceMetadata as unknown as Record<string, unknown>,
      capabilities: manifestMcpCapabilities(manifest),
      updatedAt: new Date(),
    };
    const product = existing
      ? (await db.update(products).set(values).where(eq(products.id, existing.id)).returning())[0]
      : (await db.insert(products).values({ ...values, slug: manifest.slug }).returning())[0];
    const version = await ensureProductVersion(product.id);
    console.log(`${existing ? 'Updated' : 'Added'} ${manifest.slug} @ ${version.manifestDigest.slice(0, 12)}`);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
