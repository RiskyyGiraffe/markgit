import { describe, expect, it } from 'vitest';
import { publicSourceMetadata, type IndexedSourceMetadata } from './source-metadata.js';

describe('publicSourceMetadata', () => {
  it('exposes provenance and the digest without embedding markdown in catalog cards', () => {
    const metadata: IndexedSourceMetadata = {
      schemaVersion: 'markgit.indexed-source/v1',
      repository: { owner: 'example', name: 'skill', url: 'https://github.com/example/skill', revision: 'abc123', sourceUrl: 'https://github.com/example/skill/tree/abc123', updatedAt: null },
      review: { filename: 'SKILL.md', path: 'SKILL.md', rawUrl: 'https://raw.githubusercontent.com/example/skill/abc123/SKILL.md', sha256: 'digest', markdown: '# Instructions' },
      popularity: { source: 'github', stars: 42 },
      discovery: { source: 'publisher_repository' },
      refreshedAt: '2026-08-01T00:00:00.000Z',
    };

    const result = publicSourceMetadata(metadata);
    expect(result?.review).toEqual({ filename: 'SKILL.md', path: 'SKILL.md', rawUrl: metadata.review.rawUrl, sha256: 'digest', available: true });
    expect(result).not.toHaveProperty('review.markdown');
  });
});
