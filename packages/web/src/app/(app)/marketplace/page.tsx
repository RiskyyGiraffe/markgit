import Link from "next/link";
import { ArrowUpRight, Search, ShieldCheck } from "lucide-react";
import { getQuicklist } from "@/actions/quicklist";
import { QuicklistControl } from "@/components/quicklist-control";
import { ToolLogo } from "@/components/tool-logo";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllPublicTools } from "@/lib/public-registry";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const [{ tools }, quicklist] = await Promise.all([getAllPublicTools(query), getQuicklist()]);
  const installed = new Map(quicklist.entries.map((entry) => [entry.tool.slug, entry]));

  return (
    <div>
      <section>
        <p className="text-xs font-medium text-muted-foreground">Marketplace</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Add tools to your agents</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Search the same public catalog you see before login, then sync tools and authorization settings to your account.</p>
        <form action="/marketplace" className="mt-7 flex h-11 items-center rounded-xl border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/20"><Search className="size-4 text-muted-foreground" /><input name="q" type="search" defaultValue={query} placeholder="Search tools" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground" /></form>
      </section>

      <div className="mt-8 flex items-center justify-between"><h2 className="text-sm font-medium">Public tools</h2><span className="text-xs text-muted-foreground">{tools.length} listed · {quicklist.total} synced</span></div>
      <section className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
        {tools.length === 0 ? <div className="px-6 py-20 text-center"><p className="font-medium">No tools found.</p><p className="mt-2 text-sm text-muted-foreground">Try a broader capability.</p></div> : (
          <Table>
            <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="w-[40%] px-4">Tool</TableHead><TableHead>Provider</TableHead><TableHead>Usage</TableHead><TableHead>Price</TableHead><TableHead>Agent quicklist</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>{tools.map((tool) => {
              const entry = installed.get(tool.slug);
              return (
                <TableRow key={tool.id} className="group h-[76px]">
                  <TableCell className="px-4 py-3"><Link href={`/tools/${tool.slug}`} className="flex items-center gap-3"><ToolLogo name={tool.name} logoUrl={tool.logoUrl} category={tool.category} tags={tool.tags} /><span className="min-w-0"><span className="flex items-center gap-1.5 font-medium"><span className="truncate">{tool.name}</span>{tool.trust.endpoint.status === "verified" ? <ShieldCheck className="size-3.5 text-emerald-600" /> : null}</span><span className="mt-1 block max-w-sm truncate text-xs text-muted-foreground">{tool.description}</span></span></Link></TableCell>
                  <TableCell><span className="text-sm">{tool.provider.name}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{tool.provider.trustTier}</span></TableCell>
                  <TableCell><span className="text-xs">{tool.usage.invocationsLabel}</span><span className="mt-1 block text-xs text-muted-foreground">{tool.usage.usersLabel}</span></TableCell>
                  <TableCell><Badge variant="outline">{tool.pricing.type === "free" ? "Free" : `$${tool.pricing.amount} / call`}</Badge></TableCell>
                  <TableCell><QuicklistControl slug={tool.slug} initialMode={entry?.authorization.mode} versionCurrent={entry?.authorization.versionCurrent} /></TableCell>
                  <TableCell><Link href={`/tools/${tool.slug}`} aria-label={`View ${tool.name}`}><ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" /></Link></TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
