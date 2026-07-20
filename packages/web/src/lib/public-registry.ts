import type { ToolCard, ToolDocumentation } from "@markgit/sdk";

export const markgitApiUrl = (process.env.MARKGIT_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

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
