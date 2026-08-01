export type IndexedSourceMetadata = {
  schemaVersion: 'markgit.indexed-source/v1';
  repository: {
    owner: string;
    name: string;
    url: string;
    revision: string;
    sourceUrl: string;
    updatedAt: string | null;
  };
  review: {
    filename: string;
    path: string;
    rawUrl: string;
    sha256: string;
    markdown: string;
  };
  popularity: {
    source: 'github';
    stars: number;
  };
  discovery: {
    source: 'official_mcp_registry' | 'publisher_repository';
    registryName?: string;
    registryVersion?: string;
    registryUpdatedAt?: string;
    registryUrl?: string;
  };
  refreshedAt: string;
};

export function publicSourceMetadata(metadata: IndexedSourceMetadata | null | undefined) {
  if (!metadata) return null;
  return {
    repository: metadata.repository,
    review: {
      filename: metadata.review.filename,
      path: metadata.review.path,
      rawUrl: metadata.review.rawUrl,
      sha256: metadata.review.sha256,
      available: Boolean(metadata.review.markdown),
    },
    popularity: metadata.popularity,
    discovery: metadata.discovery,
    refreshedAt: metadata.refreshedAt,
  };
}
