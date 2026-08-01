import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowUpRight, Boxes, Database, Search, Shrink, Waypoints } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { getAllPublicHarnesses } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Harnesses — markgit",
  description: "Durable provider-hosted agent loops with transparent access, pricing, compaction, and monitoring.",
};

export default async function HarnessesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const { harnesses } = await getAllPublicHarnesses(query);
  return (
    <main className="min-h-screen bg-[#101213] text-[#f1f2f2]">
      <PublicHeader />
      <div className="mx-auto max-w-[960px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.19em] text-[#687176]">Durable agent loops</p>
          <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Harnesses</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#92979a] sm:text-base">
            Start a loop from any agent, monitor it from another, and see every declared API, tool, data scope, price, and compaction event.
          </p>
        </div>
        <form action="/harnesses" className="mt-8 flex h-11 items-center rounded-xl border border-white/[0.11] bg-[#1b1e20] px-3 focus-within:border-white/25">
          <Search className="size-4 text-[#777d81]" />
          <input name="q" type="search" defaultValue={query} placeholder="Search harnesses" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-[#777d81]" />
        </form>

        <div className="mt-9 grid gap-4">
          {harnesses.map((harness) => (
            <Link key={harness.id} href={`/harnesses/${harness.slug}`} className="group rounded-2xl border border-white/[0.085] bg-[#16191a] p-5 transition hover:border-white/[0.16] hover:bg-[#191c1e] sm:p-6">
              <div className="flex items-start gap-4">
                <ToolLogo name={harness.name} logoUrl={harness.logoUrl} category={harness.category} tags={harness.tags} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium tracking-[-0.025em]">{harness.name}</h2>
                      <p className="mt-1 text-xs text-[#737b7f]">by {harness.provider.name} · runtime {harness.trust.runtime.status}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs">
                      Free <ArrowUpRight className="size-3.5 text-[#6d7579] group-hover:text-white" />
                    </span>
                  </div>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[#969ca0]">{harness.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-[11px] text-[#969ca0]">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.045] px-2.5 py-1.5"><Waypoints className="size-3.5" /> {harness.access.externalApis.length} external APIs</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.045] px-2.5 py-1.5"><Boxes className="size-3.5" /> {harness.access.markgitTools.length} tools</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.045] px-2.5 py-1.5"><Database className="size-3.5" /> {harness.access.data.length} data scopes</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.045] px-2.5 py-1.5"><Shrink className="size-3.5" /> {harness.compaction.supported ? harness.compaction.strategy.replaceAll("_", " ") : "no compaction"}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.045] px-2.5 py-1.5"><Activity className="size-3.5" /> {harness.usage.runsLabel}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {harnesses.length === 0 ? <div className="py-24 text-center text-sm text-[#777d81]">No public harnesses yet.</div> : null}
      </div>
    </main>
  );
}
