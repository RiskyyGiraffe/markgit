import Link from "next/link";
import type { ToolCard } from "@markgit/sdk";
import {
  Activity,
  ArrowRight,
  Check,
  Code2,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { InstallCommandCard } from "@/components/install-command-card";
import { PublicHeader } from "@/components/public-header";
import { getAllPublicTools } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

async function getPublicTools(query: string) {
  const registry = await getAllPublicTools(query);
  return { ...registry, tools: registry.tools.slice(0, 6) };
}

function usageLabel(tool: ToolCard) {
  return `${tool.usage.usersLabel} · ${tool.usage.invocationsLabel}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const registry = await getPublicTools(query);

  return (
    <main className="min-h-screen bg-[#f6f6f1] text-[#171714]">
      <PublicHeader />

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pb-20 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/60 shadow-sm">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Open registry. Provider-hosted tools.
          </div>
          <h1 className="font-display text-5xl font-medium leading-[0.98] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
            Find a tool. See the price. Call it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-black/60 sm:text-lg sm:leading-8">
            One searchable standard for tools hosted anywhere. Free tools stay direct;
            paid tools get approval, metering, and settlement.
          </p>

          <form action="/tools" method="get" className="mx-auto mt-9 flex max-w-2xl items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-[0_16px_45px_rgba(0,0,0,0.08)]">
            <Search className="ml-3 size-5 shrink-0 text-black/35" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search tools by capability…"
              aria-label="Search public tools"
              className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-black/35"
            />
            <button type="submit" className="h-11 rounded-xl bg-[#171714] px-5 text-sm font-medium text-white transition hover:bg-black/80">
              Search
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-black/45 sm:text-sm">
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> No hosted agent</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Transparent per-call pricing</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Bring your own compute</span>
          </div>
        </div>
      </section>

      <section id="tools" className="border-y border-black/10 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">Public registry</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                {query ? `Results for “${query}”` : "Featured tools"}
              </h2>
            </div>
            <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-black/50 hover:text-black">
              Browse all {registry.total} tools <ArrowRight className="size-4" />
            </Link>
          </div>

          {registry.tools.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/15 bg-[#f6f6f1] px-6 py-14 text-center">
              <p className="font-medium">{query ? "No matching tools yet." : "The registry is temporarily unavailable."}</p>
              <p className="mt-2 text-sm text-black/50">
                {query ? "Try a broader capability or publish the first one." : "The public API may still be starting."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {registry.tools.map((tool) => (
                <article key={tool.id} className="flex min-h-64 flex-col rounded-2xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-black/25 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-[#f1f1eb] px-2.5 py-1 text-xs text-black/55">
                      {tool.category ?? "Tool"}
                    </span>
                    <span className="font-mono text-sm font-medium">
                      {tool.pricing.type === "free" ? "Free" : `$${tool.pricing.amount}`}
                    </span>
                  </div>
                  <div className="mt-5">
                    <h3 className="font-display text-xl font-semibold tracking-[-0.035em]">{tool.name}</h3>
                    <p className="mt-1 text-xs text-black/45">by {tool.provider.name}</p>
                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-black/58">
                      {tool.description ?? "No description provided."}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-black/8 pt-4 text-xs text-black/48">
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="size-3.5" />
                      {usageLabel(tool)}
                    </span>
                    <Link href={`/tools/${tool.slug}`} className="font-medium text-black hover:underline">
                      View tool
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">A small layer by design.</h2>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 md:grid-cols-3">
          {[
            { icon: Search, number: "01", title: "Discover", body: "Agents and people search the same public schemas, providers, prices, and usage." },
            { icon: ShieldCheck, number: "02", title: "Approve", body: "Paid calls return an exact quote and respect global or per-tool controls." },
            { icon: WalletCards, number: "03", title: "Call", body: "The provider runs the tool. Markgit only meters successful paid calls and settles earnings." },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="bg-[#f6f6f1] p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <Icon className="size-5" />
                  <span className="font-mono text-xs text-black/35">{step.number}</span>
                </div>
                <h3 className="mt-8 font-display text-xl font-semibold tracking-[-0.035em]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-black/55">{step.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="publish" className="border-y border-black/10 bg-[#171714] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <Code2 className="size-5" />
            </div>
            <h2 className="mt-5 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Host your tool anywhere.</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/55">
              Keep the code and compute. Add a small manifest, choose a price—including free—and publish it with one command.
            </p>
          </div>
          <InstallCommandCard />
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-black/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="font-display text-lg font-semibold tracking-[-0.04em] text-black">markgit</span>
        <span>Open discovery and optional commerce for agent tools.</span>
      </footer>
    </main>
  );
}
