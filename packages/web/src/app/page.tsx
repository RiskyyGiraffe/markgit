import Link from "next/link";
import {
  ArrowRight,
  Check,
  Code2,
  Search,
  ShieldCheck,
  WalletCards,
  Activity,
  Eye,
  Shrink,
} from "lucide-react";
import { InstallCommandCard } from "@/components/install-command-card";
import { PublicHeader } from "@/components/public-header";
import { ToolCatalogRow } from "@/components/tool-catalog-row";
import { getAllPublicTools } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

async function getPublicTools(query: string) {
  const registry = await getAllPublicTools(query);
  return { ...registry, tools: registry.tools.slice(0, 6) };
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
    <main className="min-h-screen bg-[#101213] text-[#f1f2f2]">
      <PublicHeader />

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pb-20 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-[#aeb2b4]">
            <span className="size-1.5 rounded-full bg-[#91a4ad]" />
            Open registry. Provider-hosted tools and harnesses.
          </div>
          <h1 className="font-display text-5xl font-medium leading-[0.98] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
            Call a tool. Run a harness. See everything.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[#92979a] sm:text-lg sm:leading-8">
            Tools are one atomic call. Harnesses are durable agent loops with shared monitoring,
            explicit access, compaction, and external API cost disclosure. Your compute stays wherever you host it.
          </p>

          <form action="/tools" method="get" className="mx-auto mt-9 flex max-w-2xl items-center gap-2 rounded-xl border border-white/[0.11] bg-[#1b1e20] p-2">
            <Search className="ml-3 size-5 shrink-0 text-[#777d81]" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search tools by capability…"
              aria-label="Search public tools"
              className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-[#777d81]"
            />
            <button type="submit" className="h-10 rounded-lg bg-[#e7e9e9] px-5 text-sm font-medium text-[#101213] transition hover:bg-white">
              Search
            </button>
          </form>

          <Link href="/harnesses" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-[#c8ccce] transition hover:bg-white/[0.08] hover:text-white">
            Browse monitorable harnesses <ArrowRight className="size-4" />
          </Link>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#777d81] sm:text-sm">
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Provider-hosted compute</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Transparent per-call pricing</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Bring your own compute</span>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.075] bg-[#0d0f10]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f6569]">Harnesses</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Long-running loops without a black box.</h2>
            </div>
            <Link href="/harnesses" className="inline-flex items-center gap-2 text-sm text-[#858c90] hover:text-white">Explore harnesses <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.075] bg-white/[0.075] md:grid-cols-3">
            {[
              { icon: Eye, title: "Visible access", body: "Every external API, nested tool, data scope, and retention policy is declared before the loop starts." },
              { icon: Activity, title: "Shared monitoring", body: "Codex, Claude, or any HTTP-capable agent on the account reads the same durable state and event cursor." },
              { icon: Shrink, title: "Observable compaction", body: "The harness declares its compaction strategy and emits checkpoints whenever context is compacted." },
            ].map((item) => {
              const Icon = item.icon;
              return <div key={item.title} className="bg-[#0d0f10] p-6"><Icon className="size-5" /><h3 className="mt-6 text-lg font-medium">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#858c90]">{item.body}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section id="tools" className="border-y border-white/[0.075] bg-[#131516]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f6569]">Public registry</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
                {query ? `Results for “${query}”` : "Featured tools"}
              </h2>
            </div>
            <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-[#777d81] hover:text-white">
              Browse all {registry.total} tools <ArrowRight className="size-4" />
            </Link>
          </div>

          {registry.tools.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#101213] px-6 py-14 text-center">
              <p className="font-medium">{query ? "No matching tools yet." : "The registry is temporarily unavailable."}</p>
              <p className="mt-2 text-sm text-[#777d81]">
                {query ? "Try a broader capability or publish the first one." : "The public API may still be starting."}
              </p>
            </div>
          ) : (
            <div className="grid gap-x-10 md:grid-cols-2">
              {registry.tools.map((tool) => <ToolCatalogRow key={tool.id} tool={tool} />)}
            </div>
          )}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f6569]">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">A small layer by design.</h2>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.075] bg-white/[0.075] md:grid-cols-3">
          {[
            { icon: Search, number: "01", title: "Discover", body: "Agents and people search the same public schemas, providers, prices, and usage." },
            { icon: ShieldCheck, number: "02", title: "Approve", body: "Paid calls return an exact quote and respect global or per-tool controls." },
            { icon: WalletCards, number: "03", title: "Call", body: "The provider runs the tool. Markgit only meters successful paid calls and settles earnings." },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="bg-[#101213] p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <Icon className="size-5" />
                  <span className="font-mono text-xs text-[#5f6569]">{step.number}</span>
                </div>
                <h3 className="mt-8 font-display text-xl font-semibold tracking-[-0.035em]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#858b8f]">{step.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="publish" className="border-y border-white/[0.075] bg-[#0b0d0e] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
              <Code2 className="size-5" />
            </div>
            <h2 className="mt-5 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Host your tool anywhere.</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/55">
              Keep the code and compute. Publish a priced or free atomic tool, or a free durable harness with explicit external API costs, through one agent-neutral contract.
            </p>
          </div>
          <InstallCommandCard />
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[#656b6f] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="font-display text-lg font-semibold tracking-[-0.04em] text-[#e7e9e9]">markgit</span>
        <span>Open discovery for tools and harnesses. Commerce applies only to tools.</span>
      </footer>
    </main>
  );
}
