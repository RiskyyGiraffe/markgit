import type { Metadata } from "next";
import { Activity, Bot, Braces, Check, KeyRound, Search, Sparkles, WalletCards } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { markgitApiUrl } from "@/lib/public-registry";

export const metadata: Metadata = {
  title: "Documentation — markgit",
  description: "Machine-readable discovery documentation for Markgit tools, harnesses, MCP servers, and source-hosted skills.",
};

const formats = [
  { name: "Registry JSON", path: "/v1/registry/tools?limit=100", icon: Search, body: "All public tools, providers, prices, usage, input schemas, output schemas, and documentation links." },
  { name: "Harness Registry", path: "/v1/registry/harnesses?limit=100", icon: Activity, body: "Durable loops with frozen access manifests, external API pricing, loop limits, compaction, and monitoring contracts." },
  { name: "MCP Registry", path: "/v1/registry/mcps?limit=100", icon: Bot, body: "Remote MCP servers with direct connection details, authentication, declared tools, resources, prompts, and trust." },
  { name: "Skills Registry", path: "/v1/registry/skills?limit=100", icon: Sparkles, body: "Source-hosted SKILL.md packages with publisher provenance, immutable revisions, compatibility, contents, and install guidance." },
  { name: "Leaderboard", path: "/v1/registry/leaderboard?limit=25", icon: Activity, body: "Independent rankings using Markgit calls/runs or current source-repository stars, with the metric attached to every entry." },
  { name: "Registry llms.txt", path: "/v1/registry/llms.txt", icon: Bot, body: "A concise plain-text index designed for language-model context and retrieval." },
  { name: "Per-tool OpenAPI", path: "/v1/registry/tools/{slug}/openapi.json", icon: Braces, body: "OpenAPI 3.1 for the exact quote and call operations, including the tool-specific input and output shapes." },
  { name: "Per-harness OpenAPI", path: "/v1/registry/harnesses/{slug}/openapi.json", icon: Braces, body: "Vendor-neutral approval, start, monitor, event cursor, and cancel operations for a free durable harness run." },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#101213] text-[#f1f2f2]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-xs text-[#aeb2b4]">
            <Bot className="size-3.5" /> Built for people and agents
          </div>
          <h1 className="mt-5 font-display text-4xl font-medium tracking-[-0.06em] sm:text-6xl">Docs an LLM can use directly.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[#92979a] sm:text-lg">
            Every listing says whether it is an atomic tool, durable harness, remote MCP server, or source-hosted skill. Indexed MCP and skill docs expose provenance, immutable source revisions, and reviewable Markdown without Markgit automatically installing or executing package code.
          </p>
        </div>

        <section className="mt-14 grid gap-px overflow-hidden rounded-xl border border-white/[0.075] bg-white/[0.075] md:grid-cols-2 lg:grid-cols-3">
          {formats.map((format) => {
            const Icon = format.icon;
            const href = `${markgitApiUrl}${format.path}`;
            return (
              <a key={format.name} href={href} className="bg-[#131516] p-6 transition hover:bg-[#171a1c]">
                <Icon className="size-5" />
                <h2 className="mt-7 font-semibold">{format.name}</h2>
                <p className="mt-2 min-h-20 text-sm leading-6 text-[#858b8f]">{format.body}</p>
                <code className="mt-5 block break-all text-[11px] text-[#5f6569]">{format.path}</code>
              </a>
            );
          })}
        </section>

        <section className="grid gap-10 border-b border-white/[0.075] py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f6569]">Invocation contract</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">Approval is explicit.</h2>
            <p className="mt-4 text-sm leading-7 text-[#858b8f]">Agents never have to guess the charge. The quote response contains the provider price, Markgit fee, exact total, expiration, and policy decision.</p>
          </div>
          <div className="space-y-4">
            {[
              { icon: Search, title: "1. Discover", body: "Read public schemas and select the tool by capability, price, provider, and usage." },
              { icon: WalletCards, title: "2. Quote", body: "Request the exact total and confirm global and per-tool spend controls permit it." },
              { icon: Check, title: "3. Approve", body: "Obtain user approval or apply a pre-authorized maximum-cost policy." },
              { icon: KeyRound, title: "4. Call", body: "Send the approved quote ID, input object, API key, and idempotency key." },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="grid grid-cols-[40px_1fr] gap-4 rounded-xl border border-white/[0.075] bg-[#131516] p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white/[0.055]"><Icon className="size-4" /></span>
                  <div><h3 className="font-medium">{step.title}</h3><p className="mt-1 text-sm leading-6 text-[#858b8f]">{step.body}</p></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pt-14">
          <h2 className="text-2xl font-semibold tracking-[-0.035em]">Start with the registry</h2>
          <pre className="mt-5 overflow-auto rounded-xl border border-white/[0.075] bg-[#0b0d0e] p-5 text-sm leading-7 text-[#c3c7c9]"><code>{`# Atomic tools\ncurl ${markgitApiUrl}/v1/registry/tools?limit=100\n\n# Durable harnesses\ncurl ${markgitApiUrl}/v1/registry/harnesses?limit=100\n\n# Remote MCP servers\ncurl ${markgitApiUrl}/v1/registry/mcps?limit=100\n\n# Source-hosted agent skills\ncurl ${markgitApiUrl}/v1/registry/skills?limit=100\n\n# Per-category rankings\ncurl ${markgitApiUrl}/v1/registry/leaderboard?limit=25\n\n# LLM-friendly combined index\ncurl ${markgitApiUrl}/v1/registry/llms.txt\n\n# Exact schemas for one tool\ncurl ${markgitApiUrl}/v1/registry/tools/{slug}/docs\n\n# Access, pricing, compaction, and monitoring for one harness\ncurl ${markgitApiUrl}/v1/registry/harnesses/{slug}/docs\n\n# Direct connection, source, and README snapshot\ncurl ${markgitApiUrl}/v1/registry/mcps/{slug}/docs\ncurl ${markgitApiUrl}/v1/registry/mcps/{slug}/review.md\n\n# Provenance, install guidance, and SKILL.md snapshot\ncurl ${markgitApiUrl}/v1/registry/skills/{slug}/docs\ncurl ${markgitApiUrl}/v1/registry/skills/{slug}/review.md`}</code></pre>
        </section>
      </div>
    </main>
  );
}
