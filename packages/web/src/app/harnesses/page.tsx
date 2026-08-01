import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Search, ShieldCheck } from "lucide-react";
import { CatalogTabs } from "@/components/catalog-tabs";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllPublicHarnesses } from "@/lib/public-registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Custom Loops — markgit", description: "Free provider-hosted agent loops with explicit goals, wallet budgets, and shared monitoring." };

export default async function HarnessesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const { harnesses } = await getAllPublicHarnesses(query);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <CatalogTabs active="harnesses" />
        <section className="pt-10">
          <h1 className="font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Custom Loops</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">Durable agent loops with frozen access, compaction, and a shared event stream. Always free through Markgit.</p>
          <form action="/harnesses" className="mt-7 flex h-11 items-center rounded-xl border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/20"><Search className="size-4 text-muted-foreground" /><input name="q" type="search" defaultValue={query} placeholder="Search custom loops" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground" /></form>
        </section>
        <div className="mt-9 flex items-center justify-between"><h2 className="text-sm font-medium">Public custom loops</h2><span className="text-xs text-muted-foreground">{harnesses.length} listed</span></div>
        <section className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          {harnesses.length === 0 ? <div className="px-6 py-20 text-center"><p className="font-medium">No public custom loops yet.</p><p className="mt-2 text-sm text-muted-foreground">Publish one with <code>markgit loop onboard</code>.</p></div> : (
            <Table>
              <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="w-[42%] px-4">Custom loop</TableHead><TableHead>Provider</TableHead><TableHead>Access</TableHead><TableHead>Usage</TableHead><TableHead>Price</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>{harnesses.map((harness) => (
                <TableRow key={harness.id} className="group h-[78px]">
                  <TableCell className="px-4 py-3"><Link href={`/harnesses/${harness.slug}`} className="flex items-center gap-3"><ToolLogo name={harness.name} logoUrl={harness.logoUrl} category={harness.category} tags={harness.tags} /><span className="min-w-0"><span className="flex items-center gap-1.5 font-medium"><span className="truncate">{harness.name}</span>{harness.trust.runtime.status === "verified" ? <ShieldCheck className="size-3.5 text-emerald-600" /> : null}</span><span className="mt-1 block max-w-md truncate text-xs text-muted-foreground">{harness.description}</span></span></Link></TableCell>
                  <TableCell><span className="text-sm">{harness.provider.name}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{harness.provider.trustTier}</span></TableCell>
                  <TableCell><span className="text-xs">{harness.access.externalApis.length} APIs · {harness.access.markgitTools.length} tools</span><span className="mt-1 block text-xs text-muted-foreground">{harness.compaction.supported ? `${harness.compaction.strategy.replaceAll("_", " ")} compaction` : "No compaction"}</span></TableCell>
                  <TableCell><span className="text-xs">{harness.usage.runsLabel}</span><span className="mt-1 block text-xs text-muted-foreground">{harness.usage.usersLabel}</span></TableCell>
                  <TableCell><span className="inline-flex rounded-md border bg-background px-2.5 py-1 text-xs font-medium">Free</span></TableCell>
                  <TableCell><Link href={`/harnesses/${harness.slug}`} aria-label={`View ${harness.name}`}><ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" /></Link></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}
