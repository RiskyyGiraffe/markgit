import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import type { ToolCard } from "@markgit/sdk";
import { PublicHeader } from "@/components/public-header";
import { ToolCatalogRow } from "@/components/tool-catalog-row";
import { ToolLogo } from "@/components/tool-logo";
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
    <main className="min-h-screen bg-[#101213] text-[#f1f2f2]">
      <PublicHeader />
      <div className="mx-auto max-w-[920px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Tools</h1>
          <p className="mt-2 text-sm text-[#92979a] sm:text-base">
            Discover provider-hosted APIs with transparent pricing, schemas, and usage.
          </p>
        </div>

        <form action="/tools" className="mt-7 flex h-11 items-center rounded-xl border border-white/[0.11] bg-[#1b1e20] px-3 transition focus-within:border-white/25 focus-within:bg-[#1e2123]">
          <Search className="size-4 shrink-0 text-[#777d81]" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search tools"
            aria-label="Search all tools"
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-[#f1f2f2] outline-none placeholder:text-[#777d81]"
          />
          {price !== "all" ? <input type="hidden" name="price" value={price} /> : null}
          <button type="submit" className="sr-only">Search</button>
        </form>

        {tools.length > 0 ? (
          <section className="mt-9 border-b border-white/[0.075] pb-7">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#dfe1e2]">Available now</h2>
              <span className="text-[11px] text-[#656b6f]">{tools.length} public</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tools.slice(0, 14).map((tool) => (
                <Link
                  key={`rail-${tool.id}`}
                  href={`/tools/${tool.slug}`}
                  aria-label={tool.name}
                  title={tool.name}
                  className="rounded-[11px] outline-none ring-offset-2 ring-offset-[#101213] focus-visible:ring-2 focus-visible:ring-[#879aa4]"
                >
                  <ToolLogo
                    name={tool.name}
                    logoUrl={tool.logoUrl}
                    category={tool.category}
                    tags={tool.tags}
                    size="sm"
                    className="transition hover:-translate-y-0.5 hover:border-white/20"
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-6 flex items-center justify-between pb-3">
          <div className="flex items-center gap-1 text-sm">
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
                  className={`rounded-lg px-3 py-1.5 transition ${price === value ? "bg-white/[0.075] text-[#f1f2f2]" : "text-[#747a7e] hover:text-[#d9dcde]"}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#656b6f]">
            <SlidersHorizontal className="size-3.5" />
            {tools.length} {tools.length === 1 ? "tool" : "tools"}
          </div>
        </div>

        {tools.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-medium">No tools found.</p>
            <p className="mt-2 text-sm text-[#777d81]">Try a broader capability or a different price filter.</p>
          </div>
        ) : (
          <div className="mt-7 space-y-12">
            {featured.length > 0 ? (
              <section>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.17em] text-[#61676b]">Most used</p>
                    <h2 className="mt-2 text-lg font-medium">Featured</h2>
                  </div>
                  <p className="text-[11px] text-[#61676b]">Successful Markgit calls</p>
                </div>
                <div className="mt-3 grid gap-x-10 md:grid-cols-2">
                  {featured.map((tool) => <ToolCatalogRow key={`featured-${tool.id}`} tool={tool} />)}
                </div>
              </section>
            ) : null}

            {sections.map(([category, categoryTools]) => (
              <section key={category}>
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-lg font-medium">{category}</h2>
                  <span className="text-[11px] text-[#61676b]">{categoryTools.length} listed</span>
                </div>
                <div className="mt-3 grid gap-x-10 md:grid-cols-2">
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
