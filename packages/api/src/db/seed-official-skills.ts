import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { db } from './index.js';
import { products, providers, users } from './schema.js';
import { manifestSkillConfig, skillExecutionConfig, validateSkillManifest, type SkillManifest } from '../lib/skill-manifest.js';
import { normalizeToolCapabilities } from '../lib/tool-policy.js';
import { ensureProductVersion } from '../services/product-versions.js';
import type { IndexedSourceMetadata } from '../lib/source-metadata.js';

type SourceSkill = {
  slug: string;
  repo: 'openai/plugins' | 'anthropics/skills';
  path: string;
  publisher: 'OpenAI' | 'Anthropic';
  compatibility: Array<'agent-skills' | 'codex' | 'claude-code'>;
  category: string;
  tags: string[];
  install?: SkillManifest['install'];
};

const catalog: SourceSkill[] = [
  { slug: 'codex-frontend-app-builder', repo: 'openai/plugins', path: 'plugins/build-web-apps/skills/frontend-app-builder', publisher: 'OpenAI', compatibility: ['agent-skills', 'codex'], category: 'development', tags: ['codex', 'frontend', 'design'] },
  { slug: 'codex-shadcn', repo: 'openai/plugins', path: 'plugins/build-web-apps/skills/shadcn-best-practices', publisher: 'OpenAI', compatibility: ['agent-skills', 'codex'], category: 'development', tags: ['codex', 'shadcn', 'react'] },
  { slug: 'codex-threat-model', repo: 'openai/plugins', path: 'plugins/codex-security/skills/threat-model', publisher: 'OpenAI', compatibility: ['agent-skills', 'codex'], category: 'security', tags: ['codex', 'security', 'threat-modeling'] },
  { slug: 'claude-frontend-design', repo: 'anthropics/skills', path: 'skills/frontend-design', publisher: 'Anthropic', compatibility: ['agent-skills', 'claude-code'], category: 'design', tags: ['claude', 'frontend', 'design'], install: { claudeCode: '/plugin install example-skills@anthropic-agent-skills' } },
  { slug: 'claude-mcp-builder', repo: 'anthropics/skills', path: 'skills/mcp-builder', publisher: 'Anthropic', compatibility: ['agent-skills', 'claude-code'], category: 'development', tags: ['claude', 'mcp', 'development'], install: { claudeCode: '/plugin install example-skills@anthropic-agent-skills' } },
  { slug: 'claude-webapp-testing', repo: 'anthropics/skills', path: 'skills/webapp-testing', publisher: 'Anthropic', compatibility: ['agent-skills', 'claude-code'], category: 'testing', tags: ['claude', 'testing', 'web'], install: { claudeCode: '/plugin install example-skills@anthropic-agent-skills' } },
];

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'markgit-official-skill-indexer' };

async function githubJson<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

function skillMetadata(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error('SKILL.md is missing YAML frontmatter');
  const metadata = parseYaml(match[1]) as { name?: string; description?: string };
  if (!metadata.name || !metadata.description) throw new Error('SKILL.md frontmatter is missing name or description');
  return metadata;
}

async function providerFor(userId: string, publisher: SourceSkill['publisher'], repo: SourceSkill['repo']) {
  const name = `${publisher} Skills Index`;
  const [existing] = await db.select().from(providers).where(eq(providers.name, name)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(providers).values({
    userId,
    name,
    description: `Markgit index of source-hosted skills from the official ${repo} repository. The source publisher does not operate this Markgit account.`,
    websiteUrl: `https://github.com/${repo}`,
    trustTier: 'basic',
  }).returning();
  return created;
}

async function main() {
  let [owner] = await db.select().from(users).where(eq(users.email, 'admin@markgit.dev')).limit(1);
  if (!owner) [owner] = await db.insert(users).values({ email: 'admin@markgit.dev', name: 'Markgit Registry' }).returning();
  const repositories = new Map<string, { revision: string; updatedAt: string | null; stars: number }>();

  for (const source of catalog) {
    let repository = repositories.get(source.repo);
    if (!repository) {
      const [commit, repo] = await Promise.all([
        githubJson<{ sha: string; commit: { committer: { date: string | null } } }>(`/repos/${source.repo}/commits/main`),
        githubJson<{ stargazers_count: number }>(`/repos/${source.repo}`),
      ]);
      repository = { revision: commit.sha, updatedAt: commit.commit.committer.date, stars: repo.stargazers_count };
      repositories.set(source.repo, repository);
    }
    const revision = repository.revision;
    const [skillFile, directory] = await Promise.all([
      fetch(`https://raw.githubusercontent.com/${source.repo}/${revision}/${source.path}/SKILL.md`).then(async (response) => {
        if (!response.ok) throw new Error(`${source.path}/SKILL.md returned ${response.status}`);
        return response.text();
      }),
      githubJson<Array<{ name: string; type: string }>>(`/repos/${source.repo}/contents/${source.path}?ref=${revision}`),
    ]);
    const metadata = skillMetadata(skillFile);
    const names = new Set(directory.map((entry) => entry.name));
    const licenseUrl = names.has('LICENSE.txt')
      ? `https://github.com/${source.repo}/blob/${revision}/${source.path}/LICENSE.txt`
      : undefined;
    const manifest = validateSkillManifest({
      schemaVersion: '1',
      kind: 'skill',
      name: metadata.name,
      slug: source.slug,
      description: metadata.description,
      category: source.category,
      tags: source.tags,
      source: {
        publisher: source.publisher,
        repositoryUrl: `https://github.com/${source.repo}`,
        url: `https://github.com/${source.repo}/tree/${revision}/${source.path}`,
        path: source.path,
        revision,
        licenseUrl,
      },
      compatibility: source.compatibility,
      install: source.install,
      contents: {
        scripts: names.has('scripts'),
        references: names.has('references') || names.has('reference'),
        assets: names.has('assets'),
      },
    });
    const provider = await providerFor(owner.id, source.publisher, source.repo);
    const [existing] = await db.select().from(products).where(eq(products.slug, source.slug)).limit(1);
    const executionConfig = skillExecutionConfig(manifest);
    const [repositoryOwner, repositoryName] = source.repo.split('/');
    const rawUrl = `https://raw.githubusercontent.com/${source.repo}/${revision}/${source.path}/SKILL.md`;
    const sourceMetadata = {
      schemaVersion: 'markgit.indexed-source/v1',
      repository: {
        owner: repositoryOwner,
        name: repositoryName,
        url: `https://github.com/${source.repo}`,
        revision,
        sourceUrl: manifest.source.url,
        updatedAt: repository.updatedAt,
      },
      review: {
        filename: 'SKILL.md',
        path: `${source.path}/SKILL.md`,
        rawUrl,
        sha256: createHash('sha256').update(skillFile).digest('hex'),
        markdown: skillFile,
      },
      popularity: { source: 'github', stars: repository.stars },
      discovery: { source: 'publisher_repository' },
      refreshedAt: new Date().toISOString(),
    } satisfies IndexedSourceMetadata;
    const values = {
      providerId: provider.id,
      name: manifest.name,
      description: manifest.description,
      category: manifest.category,
      kind: 'skill' as const,
      status: 'active' as const,
      pricePerCallUsd: '0.0000',
      tags: manifest.tags ?? [],
      executionConfig,
      skillConfig: manifestSkillConfig(manifest) as unknown as Record<string, unknown>,
      sourceMetadata: sourceMetadata as unknown as Record<string, unknown>,
      capabilities: normalizeToolCapabilities({
        readOnly: true,
        openWorld: false,
        seesUntrustedContent: true,
        executesCode: manifest.contents?.scripts ?? false,
        dataRetention: 'none',
      }, executionConfig),
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
