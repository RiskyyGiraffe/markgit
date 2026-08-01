import { listAllPublicHarnesses } from './harness-registry.js';
import { listAllPublicMcps } from './mcp-registry.js';
import { listAllPublicTools } from './registry.js';
import { listAllPublicSkills } from './skill-registry.js';

type LeaderboardKind = 'tool' | 'harness' | 'mcp' | 'skill';

type UnrankedEntry = {
  kind: LeaderboardKind;
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provider: string;
  logoUrl: string | null;
  value: number;
  metric: 'markgit_completed_calls' | 'markgit_completed_runs' | 'github_stars';
  metricLabel: string;
  sourceUrl: string | null;
  updatedAt: Date | string;
};

function ranked(entries: UnrankedEntry[], limit: number) {
  return entries
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

export async function buildLeaderboard(limit = 10) {
  const [tools, harnesses, mcps, skills] = await Promise.all([
    listAllPublicTools(),
    listAllPublicHarnesses(),
    listAllPublicMcps(),
    listAllPublicSkills(),
  ]);

  return {
    schemaVersion: 'markgit.leaderboard/v1' as const,
    generatedAt: new Date().toISOString(),
    methodology: {
      separation: 'Each product kind is ranked independently; values from different metrics are never combined.',
      tools: 'Completed calls observed by the Markgit gateway.',
      harnesses: 'Runs observed by Markgit that progressed beyond pending, starting, or failed.',
      mcps: 'Current GitHub stars for the indexed first-party source repository. Direct MCP traffic is not visible to Markgit.',
      skills: 'Current GitHub stars for the indexed source repository. Installs outside Markgit are not visible to Markgit.',
      tieBreak: 'Name, ascending.',
    },
    categories: {
      tools: {
        metric: 'markgit_completed_calls' as const,
        entries: ranked(tools.map((tool) => ({
          kind: 'tool' as const,
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          description: tool.description,
          provider: tool.provider.name,
          logoUrl: tool.logoUrl,
          value: tool.usage.count,
          metric: 'markgit_completed_calls' as const,
          metricLabel: `${tool.usage.count.toLocaleString('en-US')} Markgit calls`,
          sourceUrl: null,
          updatedAt: tool.updatedAt,
        })), limit),
      },
      harnesses: {
        metric: 'markgit_completed_runs' as const,
        entries: ranked(harnesses.map((harness) => ({
          kind: 'harness' as const,
          id: harness.id,
          slug: harness.slug,
          name: harness.name,
          description: harness.description,
          provider: harness.provider.name,
          logoUrl: harness.logoUrl,
          value: harness.usage.runs,
          metric: 'markgit_completed_runs' as const,
          metricLabel: `${harness.usage.runs.toLocaleString('en-US')} Markgit runs`,
          sourceUrl: null,
          updatedAt: harness.updatedAt,
        })), limit),
      },
      mcps: {
        metric: 'github_stars' as const,
        entries: ranked(mcps.map((mcp) => ({
          kind: 'mcp' as const,
          id: mcp.id,
          slug: mcp.slug,
          name: mcp.name,
          description: mcp.description,
          provider: mcp.provider.name,
          logoUrl: mcp.logoUrl,
          value: mcp.sourceMetadata?.popularity.stars ?? 0,
          metric: 'github_stars' as const,
          metricLabel: `${(mcp.sourceMetadata?.popularity.stars ?? 0).toLocaleString('en-US')} GitHub stars`,
          sourceUrl: mcp.sourceMetadata?.repository.sourceUrl ?? mcp.source?.url ?? null,
          updatedAt: mcp.updatedAt,
        })), limit),
      },
      skills: {
        metric: 'github_stars' as const,
        entries: ranked(skills.map((skill) => ({
          kind: 'skill' as const,
          id: skill.id,
          slug: skill.slug,
          name: skill.name,
          description: skill.description,
          provider: skill.provider.name,
          logoUrl: skill.logoUrl,
          value: skill.sourceMetadata?.popularity.stars ?? 0,
          metric: 'github_stars' as const,
          metricLabel: `${(skill.sourceMetadata?.popularity.stars ?? 0).toLocaleString('en-US')} GitHub stars`,
          sourceUrl: skill.source.url,
          updatedAt: skill.updatedAt,
        })), limit),
      },
    },
  };
}
