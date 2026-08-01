import { ValidationError } from './errors.js';
import { normalizeOptionalLogoUrl } from './public-asset-url.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPATIBILITY = ['agent-skills', 'codex', 'claude-code'] as const;

export type SkillCompatibility = (typeof COMPATIBILITY)[number];

export type SkillManifest = {
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
  install?: {
    codex?: string;
    claudeCode?: string;
    universal?: string;
  };
  contents?: {
    scripts?: boolean;
    references?: boolean;
    assets?: boolean;
  };
};

export type SkillConfig = {
  format: 'agent-skills/v1';
  entrypoint: 'SKILL.md';
  source: SkillManifest['source'];
  compatibility: SkillCompatibility[];
  install: NonNullable<SkillManifest['install']>;
  contents: Required<NonNullable<SkillManifest['contents']>>;
};

function httpsUrl(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ValidationError(`${field} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(`${field} must be a valid URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new ValidationError(`${field} must be a credential-free HTTPS URL`);
  }
  return url.toString();
}

function validateInstallCommand(value: unknown, field: string) {
  if (value === undefined) return;
  if (typeof value !== 'string' || !value.trim() || value.length > 2_000 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ValidationError(`${field} must be a single printable command under 2000 characters`);
  }
}

export function validateSkillManifest(value: unknown): SkillManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Skill manifest must be a JSON object');
  }
  const manifest = value as Partial<SkillManifest>;
  if (manifest.schemaVersion !== '1') throw new ValidationError('schemaVersion must be "1"');
  if (manifest.kind !== 'skill') throw new ValidationError('kind must be "skill"');
  if (!manifest.name?.trim() || manifest.name.length > 255) throw new ValidationError('name is required and must be at most 255 characters');
  if (!manifest.slug || !SLUG_PATTERN.test(manifest.slug) || manifest.slug.length > 255) {
    throw new ValidationError('slug must contain lowercase letters, numbers, and single hyphens');
  }
  if (!manifest.description?.trim()) throw new ValidationError('description is required');
  if (manifest.logoUrl) manifest.logoUrl = normalizeOptionalLogoUrl(manifest.logoUrl);
  if (!manifest.source || typeof manifest.source !== 'object') throw new ValidationError('source is required');
  manifest.source.repositoryUrl = httpsUrl(manifest.source.repositoryUrl, 'source.repositoryUrl');
  manifest.source.url = httpsUrl(manifest.source.url, 'source.url');
  if (manifest.source.licenseUrl) manifest.source.licenseUrl = httpsUrl(manifest.source.licenseUrl, 'source.licenseUrl');
  if (!manifest.source.path?.trim() || manifest.source.path.startsWith('/') || manifest.source.path.split('/').includes('..')) {
    throw new ValidationError('source.path must be a repository-relative path');
  }
  if (!manifest.source.revision?.trim() || manifest.source.revision.length > 255) {
    throw new ValidationError('source.revision is required and must be at most 255 characters');
  }
  if (!Array.isArray(manifest.compatibility) || manifest.compatibility.length === 0
    || manifest.compatibility.some((item) => !COMPATIBILITY.includes(item))) {
    throw new ValidationError('compatibility must include agent-skills, codex, or claude-code');
  }
  manifest.compatibility = [...new Set(manifest.compatibility)];
  validateInstallCommand(manifest.install?.codex, 'install.codex');
  validateInstallCommand(manifest.install?.claudeCode, 'install.claudeCode');
  validateInstallCommand(manifest.install?.universal, 'install.universal');
  if (manifest.tags && (!Array.isArray(manifest.tags) || manifest.tags.some((tag) => typeof tag !== 'string' || !tag.trim()))) {
    throw new ValidationError('tags must be an array of non-empty strings');
  }
  if (manifest.provider && !manifest.provider.name?.trim()) throw new ValidationError('provider.name is required when provider metadata is included');
  return manifest as SkillManifest;
}

export function manifestSkillConfig(manifest: SkillManifest): SkillConfig {
  return {
    format: 'agent-skills/v1',
    entrypoint: 'SKILL.md',
    source: manifest.source,
    compatibility: manifest.compatibility,
    install: manifest.install ?? {},
    contents: {
      scripts: manifest.contents?.scripts ?? false,
      references: manifest.contents?.references ?? false,
      assets: manifest.contents?.assets ?? false,
    },
  };
}

export function skillExecutionConfig(manifest: SkillManifest) {
  return {
    type: 'skill_package',
    protocol: 'agent-skills/v1',
    method: 'GET',
    baseUrl: manifest.source.url,
    auth: { mode: 'none', type: 'none' },
  };
}
