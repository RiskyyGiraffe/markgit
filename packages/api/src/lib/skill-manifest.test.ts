import { describe, expect, it } from 'vitest';
import { manifestSkillConfig, validateSkillManifest } from './skill-manifest.js';

const valid = {
  schemaVersion: '1',
  kind: 'skill',
  name: 'Threat Model',
  slug: 'threat-model',
  description: 'Build a repository-specific threat model.',
  source: {
    publisher: 'OpenAI',
    repositoryUrl: 'https://github.com/openai/plugins',
    url: 'https://github.com/openai/plugins/tree/main/plugins/codex-security/skills/threat-model',
    path: 'plugins/codex-security/skills/threat-model',
    revision: 'main',
  },
  compatibility: ['agent-skills', 'codex'],
  install: { codex: '$skill-installer install https://github.com/openai/plugins/tree/main/plugins/codex-security/skills/threat-model' },
} as const;

describe('skill manifests', () => {
  it('validates source-hosted standard skill packages', () => {
    const manifest = validateSkillManifest(structuredClone(valid));
    expect(manifestSkillConfig(manifest)).toMatchObject({ format: 'agent-skills/v1', entrypoint: 'SKILL.md' });
  });

  it('rejects unsafe source paths and install commands', () => {
    expect(() => validateSkillManifest({ ...valid, source: { ...valid.source, path: '../secret' } })).toThrow(/source.path/);
    expect(() => validateSkillManifest({ ...valid, install: { codex: 'one\ntwo' } })).toThrow(/printable command/);
  });
});
