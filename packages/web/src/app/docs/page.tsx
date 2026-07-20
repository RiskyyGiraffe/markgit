import type { Metadata } from "next";
import { Bot, Braces, Check, KeyRound, Search, WalletCards } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { markgitApiUrl } from "@/lib/public-registry";

export const metadata: Metadata = {
  title: "Documentation — markgit",
  description: "Machine-readable discovery and invocation documentation for Markgit tools.",
};

const formats = [
  { name: "Registry JSON", path: "/v1/registry/tools?limit=100", icon: Search, body: "All public tools, providers, prices, usage, input schemas, output schemas, and documentation links." },
  { name: "Registry llms.txt", path: "/v1/registry/llms.txt", icon: Bot, body: "A concise plain-text index designed for language-model context and retrieval." },
  { name: "Per-tool OpenAPI", path: "/v1/registry/tools/{slug}/openapi.json", icon: Braces, body: "OpenAPI 3.1 for the exact quote and call operations, including the tool-specific input and output shapes." },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#f8f8f5] text-[#171714]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-black/50">
            <Bot className="size-3.5" /> Built for people and agents
          </div>
          <h1 className="mt-5 font-display text-4xl font-medium tracking-[-0.06em] sm:text-6xl">Docs an LLM can use directly.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-black/55 sm:text-lg">
            Every listing publishes its request schema, expected output, exact pricing flow, normalized return envelope, usage coverage, and provider identity in JSON, OpenAPI, and plain text.
          </p>
        </div>

        <section className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 md:grid-cols-3">
          {formats.map((format) => {
            const Icon = format.icon;
            const href = `${markgitApiUrl}${format.path}`;
            return (
              <a key={format.name} href={href} className="bg-[#f8f8f5] p-6 transition hover:bg-white">
                <Icon className="size-5" />
                <h2 className="mt-7 font-semibold">{format.name}</h2>
                <p className="mt-2 min-h-20 text-sm leading-6 text-black/50">{format.body}</p>
                <code className="mt-5 block break-all text-[11px] text-black/38">{format.path}</code>
              </a>
            );
          })}
        </section>

        <section className="grid gap-10 border-b border-black/10 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Invocation contract</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">Approval is explicit.</h2>
            <p className="mt-4 text-sm leading-7 text-black/50">Agents never have to guess the charge. The quote response contains the provider price, Markgit fee, exact total, expiration, and policy decision.</p>
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
                <div key={step.title} className="grid grid-cols-[40px_1fr] gap-4 rounded-2xl border border-black/8 bg-white p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-black/[0.045]"><Icon className="size-4" /></span>
                  <div><h3 className="font-medium">{step.title}</h3><p className="mt-1 text-sm leading-6 text-black/48">{step.body}</p></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pt-14">
          <h2 className="text-2xl font-semibold tracking-[-0.035em]">Start with the registry</h2>
          <pre className="mt-5 overflow-auto rounded-2xl bg-[#171714] p-5 text-sm leading-7 text-white/75"><code>{`curl ${markgitApiUrl}/v1/registry/tools?limit=100\n\n# LLM-friendly index\ncurl ${markgitApiUrl}/v1/registry/llms.txt\n\n# Exact schemas for one tool\ncurl ${markgitApiUrl}/v1/registry/tools/{slug}/docs`}</code></pre>
        </section>
      </div>
    </main>
  );
}
