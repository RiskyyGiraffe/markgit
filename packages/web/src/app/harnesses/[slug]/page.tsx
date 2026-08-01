import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Bot, Boxes, Braces, Database, ExternalLink, LockKeyhole, RefreshCw, Shrink, Waypoints } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { getPublicHarness } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const harness = await getPublicHarness(slug);
  return harness ? { title: `${harness.name} custom loop — markgit`, description: harness.description ?? undefined } : { title: "Custom loop not found — markgit" };
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="overflow-auto rounded-xl border border-white/[0.08] bg-[#0b0d0e] p-5 text-xs leading-6 text-[#c3c7c9]"><code>{JSON.stringify(value, null, 2)}</code></pre>;
}

function Price({ pricing }: { pricing: { type: string; amountUsd?: string; note?: string } }) {
  return <span>{pricing.type === "free" ? "Free" : pricing.type === "per_call" ? `$${pricing.amountUsd} / call` : pricing.type.replaceAll("_", " ")}{pricing.note ? ` · ${pricing.note}` : ""}</span>;
}

export default async function HarnessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const harness = await getPublicHarness(slug);
  if (!harness) notFound();
  const docsBase = `/v1/registry/harnesses/${harness.slug}`;
  return (
    <main className="min-h-screen bg-[#101213] text-[#f1f2f2]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-9 sm:px-8 sm:pt-12">
        <Link href="/harnesses" className="inline-flex items-center gap-2 text-sm text-[#777d81] hover:text-white"><ArrowLeft className="size-4" /> All custom loops</Link>
        <section className="mt-8 border-b border-white/[0.075] pb-10">
          <div className="flex flex-col justify-between gap-8 md:flex-row">
            <div className="max-w-2xl">
              <div className="flex items-start gap-4">
                <ToolLogo name={harness.name} logoUrl={harness.logoUrl} category={harness.category} tags={harness.tags} size="lg" />
                <div><p className="text-xs text-[#777d81]">Custom Loop · {harness.provider.name}</p><h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">{harness.name}</h1></div>
              </div>
              <p className="mt-6 text-sm leading-7 text-[#92979a]">{harness.description}</p>
            </div>
            <div className="min-w-56 rounded-xl border border-white/[0.09] bg-[#171a1c] p-5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#656b6f]">Markgit charge</p>
              <p className="mt-2 font-mono text-lg font-semibold">Free</p>
              <p className="mt-3 text-xs leading-5 text-[#848b8f]">Declared tool calls may debit your wallet within the limits below.</p>
              <p className="mt-2 text-xs leading-5 text-[#848b8f]">External API costs: {harness.pricing.externalApiCosts.replaceAll("_", " ")}</p>
              {harness.pricing.note ? <p className="mt-2 text-xs leading-5 text-[#6f777b]">{harness.pricing.note}</p> : null}
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-2 text-xs text-[#aeb2b4]">
            <span className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2">{harness.usage.runsLabel}</span>
            <span className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2">{harness.usage.usersLabel}</span>
            <span className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2">{harness.risk.level} risk</span>
            <span className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2">runtime {harness.trust.runtime.status}</span>
            <a href={`${docsBase}/llms.txt`} className="inline-flex items-center gap-2 rounded-lg bg-[#e7e9e9] px-3 py-2 text-[#101213]"><Bot className="size-3.5" /> LLM docs <ExternalLink className="size-3" /></a>
            <a href={`${docsBase}/openapi.json`} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2"><Braces className="size-3.5" /> OpenAPI</a>
          </div>
        </section>

        <section className="py-12">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#626a6e]">Frozen at run start</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Everything the loop can access</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#858c90]">The provider cannot report an undeclared external API or Markgit tool call. Every call appears in the shared event stream.</p>
          <p className="mt-3 max-w-3xl rounded-lg border border-amber-300/10 bg-amber-200/[0.035] px-3 py-2 text-[11px] leading-5 text-[#989187]">Provider-attested observability: Markgit validates declared references and callback identity, but provider-hosted network traffic is outside Markgit compute. A dishonest provider could omit an event.</p>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-[#151819] p-5">
              <h3 className="flex items-center gap-2 text-sm font-medium"><Waypoints className="size-4" /> External APIs</h3>
              <div className="mt-4 space-y-4">{harness.access.externalApis.length ? harness.access.externalApis.map((api) => <div key={api.id} className="border-t border-white/[0.07] pt-4"><div className="flex justify-between gap-4 text-sm"><span>{api.name}</span><span className="text-xs text-[#8d9599]"><Price pricing={api.pricing} /></span></div><p className="mt-2 text-xs leading-5 text-[#777f83]">{api.purpose}</p><p className="mt-2 font-mono text-[10px] text-[#646c70]">{api.baseUrl}</p><p className="mt-2 text-[10px] text-[#646c70]">Sends: {api.dataSent.join(", ")} · Receives: {api.dataReceived.join(", ")}</p></div>) : <p className="text-xs text-[#737b7f]">No external APIs declared.</p>}</div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-[#151819] p-5"><h3 className="flex items-center gap-2 text-sm font-medium"><Boxes className="size-4" /> Wallet-backed tools</h3><div className="mt-4 space-y-3 text-xs text-[#858c90]">{harness.access.markgitTools.length ? harness.access.markgitTools.map((tool) => <p key={tool.slug}><span className="text-[#d9dcde]">{tool.slug}</span> — {tool.purpose}{tool.maxCallsPerRun ? ` · max ${tool.maxCallsPerRun} calls/run` : ""}{tool.maxSpendUsdPerRun ? ` · max $${tool.maxSpendUsdPerRun}/run` : ""}</p>) : <p>No Markgit tools declared.</p>}</div></div>
              <div className="rounded-xl border border-white/[0.08] bg-[#151819] p-5"><h3 className="flex items-center gap-2 text-sm font-medium"><Database className="size-4" /> Data scopes</h3><div className="mt-4 space-y-3 text-xs text-[#858c90]">{harness.access.data.length ? harness.access.data.map((item) => <p key={item.id}><span className="text-[#d9dcde]">{item.id}</span> · {item.access} · {item.scope}<br />{item.purpose}</p>) : <p>No data scopes beyond run input.</p>}<p className="pt-2 text-[10px] uppercase tracking-[0.13em] text-[#626a6e]">Retention: {harness.access.dataRetention}</p></div></div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-white/[0.075] py-12 lg:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] p-5"><Activity className="size-4 text-[#8f9da4]" /><h3 className="mt-4 text-sm font-medium">Goal and limits</h3><JsonBlock value={{ goal: harness.goal, ...harness.loop }} /></div>
          <div className="rounded-xl border border-white/[0.08] p-5"><Shrink className="size-4 text-[#8f9da4]" /><h3 className="mt-4 text-sm font-medium">Compaction</h3><JsonBlock value={harness.compaction} /></div>
          <div className="rounded-xl border border-white/[0.08] p-5"><LockKeyhole className="size-4 text-[#8f9da4]" /><h3 className="mt-4 text-sm font-medium">Shared monitoring</h3><p className="mt-3 text-xs leading-6 text-[#858c90]">Codex, Claude, or any HTTP client using your account can read the same snapshot and append-only cursor stream.</p><p className="mt-3 flex items-center gap-2 font-mono text-[10px] text-[#687176]"><RefreshCw className="size-3" /> GET /v1/harness-runs/{"{runId}"}/events</p></div>
        </section>
      </div>
    </main>
  );
}
