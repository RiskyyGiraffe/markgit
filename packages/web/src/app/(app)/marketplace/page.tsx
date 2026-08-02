import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { getQuicklist } from "@/actions/quicklist";
import { QuicklistControl } from "@/components/quicklist-control";
import { ToolLogo } from "@/components/tool-logo";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { searchPublicRegistry } from "@/lib/public-registry";

type Kind = "tool" | "harness" | "mcp" | "skill";
const validKinds = new Set<Kind>(["tool", "harness", "mcp", "skill"]);
const tabs: Array<{ kind?: Kind; label: string }> = [
  { label: "All" },
  { kind: "tool", label: "Tools" },
  { kind: "harness", label: "Custom Loops" },
  { kind: "mcp", label: "MCPs" },
  { kind: "skill", label: "Skills" },
];

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const { q = "", kind: rawKind } = await searchParams;
  const query = q.trim();
  const kind = validKinds.has(rawKind as Kind) ? rawKind as Kind : undefined;
  const [registry, quicklist] = await Promise.all([searchPublicRegistry(query, kind), getQuicklist()]);
  const installed = new Map(quicklist.entries.map((entry) => [entry.tool.slug, entry]));

  return (
    <div>
      <section>
        <p className="text-xs font-medium text-muted-foreground">Marketplace</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Find anything an agent needs</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">Semantic search covers names, docs, schemas, returned data, MCP tools, loop behavior, skill instructions, and source markdown.</p>
        <form action="/marketplace" className="mt-7 flex flex-col gap-2 sm:flex-row">
          <label className="flex h-11 flex-1 items-center rounded-xl border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/20"><Search className="size-4 text-muted-foreground" /><input name="q" type="search" defaultValue={query} placeholder="Describe the job, input, output, or data you need…" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground" /></label>
          <select name="kind" defaultValue={kind ?? ""} className="h-11 rounded-xl border bg-background px-3 text-sm"><option value="">Everything</option><option value="tool">Tools</option><option value="harness">Custom loops</option><option value="mcp">MCPs</option><option value="skill">Skills</option></select>
          <button className="h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background">Search</button>
        </form>
        <nav aria-label="Marketplace types" className="mt-4 flex gap-1 overflow-x-auto border-b">
          {tabs.map((tab) => {
            const params = new URLSearchParams();
            if (query) params.set("q", query);
            if (tab.kind) params.set("kind", tab.kind);
            const active = tab.kind === kind || (!tab.kind && !kind);
            return <Link key={tab.label} href={`/marketplace${params.size ? `?${params}` : ""}`} className={`relative whitespace-nowrap px-3 py-3 text-sm transition ${active ? "font-medium text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}</Link>;
          })}
        </nav>
      </section>

      <div className="mt-8 flex items-center justify-between"><h2 className="text-sm font-medium">{tabs.find((tab) => tab.kind === kind)?.label ?? "Everything"}</h2><span className="text-xs text-muted-foreground">{registry.total} matches · {quicklist.total} tools synced · {registry.semantic ? "semantic ranking" : "full-document matching"}</span></div>
      <section className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
        {registry.results.length === 0 ? <div className="px-6 py-20 text-center"><p className="font-medium">No registry items found.</p><p className="mt-2 text-sm text-muted-foreground">Try describing the desired result or returned data instead of a product name.</p></div> : (
          <Table>
            <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="w-[38%] px-4">Item</TableHead><TableHead>Type</TableHead><TableHead>Provider</TableHead><TableHead>Use & reviews</TableHead><TableHead>Price</TableHead><TableHead>Quicklist</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>{registry.results.map((item) => {
              const entry = installed.get(item.slug);
              return <TableRow key={item.id} className="group h-[76px]">
                <TableCell className="px-4 py-3"><Link href={`/marketplace/${item.id}`} className="flex items-center gap-3"><ToolLogo name={item.name} logoUrl={item.logoUrl} category={item.category} tags={item.tags} /><span className="min-w-0"><span className="block truncate font-medium">{item.name}</span><span className="mt-1 block max-w-sm truncate text-xs text-muted-foreground">{item.description}</span></span></Link></TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{item.kind === "harness" ? "custom loop" : item.kind}</Badge></TableCell>
                <TableCell><span className="text-sm">{item.providerName}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{item.providerTrustTier}</span></TableCell>
                <TableCell><span className="text-xs">{item.usage.usageCount} uses</span><span className="mt-1 block text-xs text-muted-foreground">{item.reviews.total ? `${item.reviews.helpfulPercent}% helpful · ${item.reviews.total}` : "No reviews"}</span></TableCell>
                <TableCell><Badge variant="outline">{Number(item.pricePerCallUsd) === 0 ? "Free" : `$${item.pricePerCallUsd} / call`}</Badge></TableCell>
                <TableCell>{item.kind === "tool" ? <QuicklistControl slug={item.slug} initialMode={entry?.authorization.mode} versionCurrent={entry?.authorization.versionCurrent} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                <TableCell><Link href={`/marketplace/${item.id}`} aria-label={`View ${item.name}`}><ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" /></Link></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
