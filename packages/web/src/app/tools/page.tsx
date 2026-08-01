import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Search, ShieldCheck } from "lucide-react";
import type { ToolCard } from "@markgit/sdk";
import { CatalogTabs } from "@/components/catalog-tabs";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllPublicTools } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tools — markgit",
  description: "Search atomic provider-hosted tools with transparent pricing, usage, and trust.",
};

function byUsage(left: ToolCard, right: ToolCard) {
  return right.usage.count - left.usage.count || left.name.localeCompare(right.name);
}

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ q?: string; price?: string }> }) {
  const { q = "", price = "all" } = await searchParams;
  const query = q.trim();
  const registry = await getAllPublicTools(query);
  const tools = registry.tools
    .filter((tool) => price === "free" ? tool.pricing.type === "free" : price === "paid" ? tool.pricing.type === "per_call" : true)
    .sort(byUsage);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <CatalogTabs active="tools" />

        <section className="pt-10">
          <h1 className="font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Tools</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">One request, one response. Compare price, usage, provider, and trust before calling.</p>

          <form action="/tools" className="mt-7 flex h-11 items-center rounded-xl border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/20">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input name="q" type="search" defaultValue={query} placeholder="Search tools" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground" />
            {price !== "all" ? <input type="hidden" name="price" value={price} /> : null}
          </form>
        </section>

        {tools.length ? (
          <section className="mt-9 border-b pb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Popular</h2>
              <span className="text-xs text-muted-foreground">{tools.length} public</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {tools.slice(0, 14).map((tool) => (
                <Link key={tool.id} href={`/tools/${tool.slug}`} title={tool.name} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ToolLogo name={tool.name} logoUrl={tool.logoUrl} category={tool.category} tags={tool.tags} size="sm" className="shadow-sm transition hover:-translate-y-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-sm">
            {[["all", "All"], ["free", "Free"], ["paid", "Paid"]].map(([value, label]) => {
              const params = new URLSearchParams();
              if (query) params.set("q", query);
              if (value !== "all") params.set("price", value);
              return <Link key={value} href={`/tools${params.size ? `?${params}` : ""}`} className={`rounded-md px-3 py-1.5 transition ${price === value ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</Link>;
            })}
          </div>
          <span className="text-xs text-muted-foreground">{tools.length} {tools.length === 1 ? "tool" : "tools"}</span>
        </div>

        <section className="mt-5 overflow-hidden rounded-xl border bg-card shadow-sm">
          {tools.length === 0 ? (
            <div className="px-6 py-20 text-center"><p className="font-medium">No tools found.</p><p className="mt-2 text-sm text-muted-foreground">Try a broader capability or price filter.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableHead className="w-[44%] px-4">Tool</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((tool) => (
                  <TableRow key={tool.id} className="group h-[76px]">
                    <TableCell className="px-4 py-3">
                      <Link href={`/tools/${tool.slug}`} className="flex items-center gap-3">
                        <ToolLogo name={tool.name} logoUrl={tool.logoUrl} category={tool.category} tags={tool.tags} />
                        <span className="min-w-0"><span className="flex items-center gap-1.5 font-medium"><span className="truncate">{tool.name}</span>{tool.trust.endpoint.status === "verified" ? <ShieldCheck className="size-3.5 text-emerald-600" /> : null}</span><span className="mt-1 block max-w-md truncate text-xs text-muted-foreground">{tool.description}</span></span>
                      </Link>
                    </TableCell>
                    <TableCell><span className="text-sm">{tool.provider.name}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{tool.provider.trustTier}</span></TableCell>
                    <TableCell><span className="text-xs">{tool.usage.invocationsLabel}</span><span className="mt-1 block text-xs text-muted-foreground">{tool.usage.usersLabel}</span></TableCell>
                    <TableCell><span className="inline-flex rounded-md border bg-background px-2.5 py-1 text-xs font-medium">{tool.pricing.type === "free" ? "Free" : `$${tool.pricing.amount} / call`}</span></TableCell>
                    <TableCell><Link href={`/tools/${tool.slug}`} aria-label={`View ${tool.name}`}><ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" /></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}
