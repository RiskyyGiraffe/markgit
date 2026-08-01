import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Search, ShieldCheck } from "lucide-react";
import { CatalogTabs } from "@/components/catalog-tabs";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllPublicMcps } from "@/lib/public-registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "MCPs — markgit", description: "Discover direct provider-hosted MCP servers with transparent transport, auth, tools, and trust." };

export default async function McpsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const { mcps } = await getAllPublicMcps(query);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <CatalogTabs active="mcps" />
        <section className="pt-10">
          <h1 className="font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">MCPs</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">Connect directly to provider-hosted MCP servers. Markgit standardizes discovery and trust without proxying traffic.</p>
          <form action="/mcps" className="mt-7 flex h-11 items-center rounded-xl border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/20"><Search className="size-4 text-muted-foreground" /><input name="q" type="search" defaultValue={query} placeholder="Search MCP servers" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground" /></form>
        </section>
        <div className="mt-9 flex items-center justify-between"><h2 className="text-sm font-medium">Public MCP servers</h2><span className="text-xs text-muted-foreground">{mcps.length} listed</span></div>
        <section className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          {mcps.length === 0 ? <div className="px-6 py-20 text-center"><p className="font-medium">No public MCP servers yet.</p><p className="mt-2 text-sm text-muted-foreground">Publish one with <code>markgit mcp onboard markgit-mcp.json</code>.</p></div> : (
            <Table>
              <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="w-[42%] px-4">MCP server</TableHead><TableHead>Provider</TableHead><TableHead>Transport</TableHead><TableHead>Surface</TableHead><TableHead>Auth</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>{mcps.map((mcp) => (
                <TableRow key={mcp.id} className="group h-[78px]">
                  <TableCell className="px-4 py-3"><Link href={`/mcps/${mcp.slug}`} className="flex items-center gap-3"><ToolLogo name={mcp.name} logoUrl={mcp.logoUrl} category={mcp.category} tags={mcp.tags} /><span className="min-w-0"><span className="flex items-center gap-1.5 font-medium"><span className="truncate">{mcp.name}</span>{mcp.trust.endpoint.status === "verified" ? <ShieldCheck className="size-3.5 text-emerald-600" /> : null}</span><span className="mt-1 block max-w-md truncate text-xs text-muted-foreground">{mcp.description}</span></span></Link></TableCell>
                  <TableCell><span className="text-sm">{mcp.provider.name}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{mcp.provider.trustTier}</span></TableCell>
                  <TableCell><span className="text-xs">{mcp.server.transport.replaceAll("_", " ")}</span><span className="mt-1 block text-xs text-muted-foreground">{mcp.trust.endpoint.status}</span></TableCell>
                  <TableCell><span className="text-xs">{mcp.features.tools.length} tools</span><span className="mt-1 block text-xs text-muted-foreground">{mcp.features.resources ? "resources" : "no resources"} · {mcp.features.prompts ? "prompts" : "no prompts"}</span></TableCell>
                  <TableCell><span className="inline-flex rounded-md border bg-background px-2.5 py-1 text-xs font-medium capitalize">{mcp.server.auth.mode.replaceAll("_", " ")}</span></TableCell>
                  <TableCell><Link href={`/mcps/${mcp.slug}`} aria-label={`View ${mcp.name}`}><ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" /></Link></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}
