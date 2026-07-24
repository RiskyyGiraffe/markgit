import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import type { ToolCard } from "@markgit/sdk";
import { PublicHeader } from "@/components/public-header";
import { ToolCatalogRow } from "@/components/tool-catalog-row";
import { getAllPublicTools } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tools — markgit",
  description: "Search every provider-hosted tool on Markgit, compare prices, usage, schemas, and providers.",
};

function byUsage(left: ToolCard, right: ToolCard) {
  return right.usage.count - left.usage.count || left.name.localeCompare(right.name);
}

function categoryLabel(value: string | null) {
  if (!value) return "Other tools";
  return value
    .split(/[-_]/g)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; price?: string }>;
}) {
  const { q = "", price = "all" } = await searchParams;
  const query = q.trim();
  const registry = await getAllPublicTools(query);
  const tools = registry.tools
    .filter((tool) => price === "free" ? tool.pricing.type === "free" : price === "paid" ? tool.pricing.type === "per_call" : true)
    .sort(byUsage);
  const featured = query || price !== "all" ? [] : tools.slice(0, 6);
  const groups = new Map<string, ToolCard[]>();
  for (const tool of tools) {
    const label = categoryLabel(tool.category);
    groups.set(label, [...(groups.get(label) ?? []), tool]);
  }
  const sections = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));

  return (
    <main className="min-h-screen bg-[#f8f8f5] text-[#171714]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-medium tracking-[-0.055em] sm:text-5xl">Tools</h1>
          <p className="mt-3 text-base text-black/52 sm:text-lg">
            Provider-hosted APIs with transparent schemas, prices, and Markgit-tracked usage.
          </p>
        </div>

        <form action="/tools" className="mt-9 flex items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
          <Search className="ml-3 size-5 shrink-0 text-black/35" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search tools"
            aria-label="Search all tools"
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-black/35"
          />
          {price !== "all" ? <input type="hidden" name="price" value={price} /> : null}
          <button type="submit" className="h-11 rounded-xl bg-[#171714] px-5 text-sm font-medium text-white hover:bg-black/80">
            Search
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between border-b border-black/10 pb-4">
          <div className="flex items-center gap-1 rounded-xl bg-black/[0.045] p-1 text-sm">
            {[
              ["all", "All"],
              ["free", "Free"],
              ["paid", "Paid"],
            ].map(([value, label]) => {
              const params = new URLSearchParams();
              if (query) params.set("q", query);
              if (value !== "all") params.set("price", value);
              return (
                <Link
                  key={value}
                  href={`/tools${params.size ? `?${params}` : ""}`}
                  className={`rounded-lg px-3 py-1.5 transition ${price === value ? "bg-white text-black shadow-sm" : "text-black/45 hover:text-black"}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-black/40">
            <SlidersHorizontal className="size-3.5" />
            {tools.length} {tools.length === 1 ? "tool" : "tools"}
          </div>
        </div>

        {tools.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-medium">No tools found.</p>
            <p className="mt-2 text-sm text-black/45">Try a broader capability or a different price filter.</p>
          </div>
        ) : (
          <div className="mt-10 space-y-14">
            {featured.length > 0 ? (
              <section>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Most used</p>
                    <h2 className="mt-2 text-xl font-semibold">Featured</h2>
                  </div>
                  <p className="text-xs text-black/38">Successful Markgit calls</p>
                </div>
                <div className="mt-4 grid gap-x-12 md:grid-cols-2">
                  {featured.map((tool) => <ToolCatalogRow key={`featured-${tool.id}`} tool={tool} />)}
                </div>
              </section>
            ) : null}

            {sections.map(([category, categoryTools]) => (
              <section key={category}>
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-xl font-semibold">{category}</h2>
                  <span className="text-xs text-black/38">{categoryTools.length} listed</span>
                </div>
                <div className="mt-4 grid gap-x-12 md:grid-cols-2">
                  {categoryTools.map((tool) => <ToolCatalogRow key={tool.id} tool={tool} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
