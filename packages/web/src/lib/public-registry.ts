import type { HarnessCard, HarnessDocumentation, LeaderboardResponse, McpCard, McpDocumentation, PublicReviewsResponse, SearchResponse, SkillCard, SkillDocumentation, ToolCard, ToolDocumentation } from "@markgit/sdk";

export const markgitApiUrl = (process.env.MARKGIT_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function searchPublicRegistry(query = "", kind?: "tool" | "harness" | "mcp" | "skill", limit = 100) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (kind) params.set("kind", kind);
  const response = await fetch(`${markgitApiUrl}/v1/registry/search?${params}`, { cache: "no-store" });
  if (!response.ok) return { query, kind: kind ?? null, semantic: false, results: [], total: 0, limit, offset: 0 } as SearchResponse;
  return response.json() as Promise<SearchResponse>;
}

export async function getPublicReviews(identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/items/${encodeURIComponent(identifier)}/reviews`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<PublicReviewsResponse>;
}

export async function getAllPublicTools(query = "") {
  const tools: ToolCard[] = [];
  const pageSize = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  try {
    while (offset < total && offset < 5_000) {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (query) params.set("q", query);

      const response = await fetch(`${markgitApiUrl}/v1/registry/tools?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Registry returned ${response.status}`);
      const page = (await response.json()) as { tools: ToolCard[]; total: number };
      tools.push(...page.tools);
      total = page.total;
      if (page.tools.length === 0) break;
      offset += page.tools.length;
    }

    return { tools, total: Number.isFinite(total) ? total : tools.length };
  } catch {
    return { tools: [] as ToolCard[], total: 0 };
  }
}

export async function getPublicToolDocumentation(identifier: string) {
  const response = await fetch(
    `${markgitApiUrl}/v1/registry/tools/${encodeURIComponent(identifier)}/docs`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  return response.json() as Promise<ToolDocumentation>;
}

export async function getAllPublicHarnesses(query = "") {
  const harnesses: HarnessCard[] = [];
  const pageSize = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  try {
    while (offset < total && offset < 5_000) {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      if (query) params.set("q", query);
      const response = await fetch(`${markgitApiUrl}/v1/registry/harnesses?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Registry returned ${response.status}`);
      const page = (await response.json()) as { harnesses: HarnessCard[]; total: number };
      harnesses.push(...page.harnesses);
      total = page.total;
      if (page.harnesses.length === 0) break;
      offset += page.harnesses.length;
    }
    return { harnesses, total: Number.isFinite(total) ? total : harnesses.length };
  } catch {
    return { harnesses: [] as HarnessCard[], total: 0 };
  }
}

export async function getPublicHarness(identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/harnesses/${encodeURIComponent(identifier)}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<HarnessCard>;
}

export async function getPublicHarnessDocumentation(identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/harnesses/${encodeURIComponent(identifier)}/docs`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<HarnessDocumentation>;
}

export async function getAllPublicMcps(query = "") {
  const mcps: McpCard[] = [];
  const pageSize = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  try {
    while (offset < total && offset < 5_000) {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      if (query) params.set("q", query);
      const response = await fetch(`${markgitApiUrl}/v1/registry/mcps?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Registry returned ${response.status}`);
      const page = (await response.json()) as { mcps: McpCard[]; total: number };
      mcps.push(...page.mcps);
      total = page.total;
      if (page.mcps.length === 0) break;
      offset += page.mcps.length;
    }
    return { mcps, total: Number.isFinite(total) ? total : mcps.length };
  } catch {
    return { mcps: [] as McpCard[], total: 0 };
  }
}

export async function getPublicMcp(identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/mcps/${encodeURIComponent(identifier)}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<McpCard>;
}

export async function getPublicMcpDocumentation(identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/mcps/${encodeURIComponent(identifier)}/docs`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<McpDocumentation>;
}

export async function getAllPublicSkills(query = "") {
  const skills: SkillCard[] = [];
  const pageSize = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  try {
    while (offset < total && offset < 5_000) {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      if (query) params.set("q", query);
      const response = await fetch(`${markgitApiUrl}/v1/registry/skills?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Registry returned ${response.status}`);
      const page = (await response.json()) as { skills: SkillCard[]; total: number };
      skills.push(...page.skills);
      total = page.total;
      if (page.skills.length === 0) break;
      offset += page.skills.length;
    }
    return { skills, total: Number.isFinite(total) ? total : skills.length };
  } catch {
    return { skills: [] as SkillCard[], total: 0 };
  }
}

export async function getPublicSkill(identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/skills/${encodeURIComponent(identifier)}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<SkillCard>;
}

export async function getPublicSkillDocumentation(identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/skills/${encodeURIComponent(identifier)}/docs`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<SkillDocumentation>;
}

export async function getPublicLeaderboard(limit = 10) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/leaderboard?limit=${limit}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<LeaderboardResponse>;
}

export async function getPublicReviewMarkdown(kind: "skills" | "mcps", identifier: string) {
  const response = await fetch(`${markgitApiUrl}/v1/registry/${kind}/${encodeURIComponent(identifier)}/review.md`, { cache: "no-store" });
  return response.ok ? response.text() : null;
}
