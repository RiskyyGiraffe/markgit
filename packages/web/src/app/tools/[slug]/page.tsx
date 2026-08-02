import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Braces, ExternalLink, ShieldCheck, Users, Zap } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { PublicReviews } from "@/components/public-reviews";
import { getPublicToolDocumentation } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const docs = await getPublicToolDocumentation(slug);
  return docs ? {
    title: `${docs.tool.name} — markgit`,
    description: docs.tool.description ?? `Schemas and call documentation for ${docs.tool.name}.`,
  } : { title: "Tool not found — markgit" };
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-xl border border-white/[0.08] bg-[#0b0d0e] p-5 text-xs leading-6 text-[#c3c7c9] sm:text-[13px]">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

export default async function PublicToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const docs = await getPublicToolDocumentation(slug);
  if (!docs) notFound();
  const tool = docs.tool;
  const price = tool.pricing.type === "free" ? "Free" : `$${tool.pricing.amount} / call`;

  return (
    <main className="min-h-screen bg-[#101213] text-[#f1f2f2]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-9 sm:px-8 sm:pt-12">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-[#777d81] hover:text-[#f1f2f2]">
          <ArrowLeft className="size-4" /> All tools
        </Link>

        <section className="mt-8 border-b border-white/[0.075] pb-10">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
            <div className="max-w-2xl">
              <div className="flex items-start gap-4">
                <ToolLogo
                  name={tool.name}
                  logoUrl={tool.logoUrl}
                  category={tool.category}
                  tags={tool.tags}
                  size="lg"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#777d81]">
                    <span>{tool.category ?? "Tool"}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5" /> {tool.provider.name}
                    </span>
                  </div>
                  <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">{tool.name}</h1>
                </div>
              </div>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#92979a]">{tool.description ?? "No description provided."}</p>
            </div>
            <div className="min-w-48 rounded-xl border border-white/[0.09] bg-[#171a1c] p-5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#656b6f]">Price</p>
              <p className="mt-2 font-mono text-lg font-semibold">{price}</p>
              <p className="mt-4 text-xs leading-5 text-[#777d81]">The exact total and Markgit fee are returned before every paid call.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs text-[#aeb2b4]">
              <Users className="size-3.5" /> {tool.usage.usersLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs text-[#aeb2b4]">
              <Zap className="size-3.5" /> {tool.usage.invocationsLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs text-[#aeb2b4]">
              <ShieldCheck className="size-3.5" /> {tool.trust.endpoint.status} endpoint
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs text-[#aeb2b4]">
              {tool.risk.level} risk · {tool.policy.approval.requirement.replaceAll("_", " ")}
            </span>
            <a href={docs.documentation.llms} className="inline-flex items-center gap-2 rounded-lg bg-[#e7e9e9] px-3 py-2 text-xs text-[#101213] hover:bg-white">
              <Bot className="size-3.5" /> LLM docs <ExternalLink className="size-3" />
            </a>
            <a href={docs.documentation.openapi} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs text-[#aeb2b4] hover:text-white">
              <Braces className="size-3.5" /> OpenAPI 3.1 <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="mt-3 text-[11px] text-[#5f6569]">Usage covers successful calls made through Markgit; direct provider calls are not observable.</p>
          {tool.policy.reasons.length > 0 && (
            <p className="mt-2 text-[11px] text-[#777d81]">Policy: {tool.policy.reasons.join(" · ")}</p>
          )}
        </section>

        <section className="grid gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f6569]">Agent flow</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Quote, approve, call.</h2>
            <ol className="mt-6 space-y-4">
              {docs.invocation.flow.map((step, index) => (
                <li key={step} className="grid grid-cols-[28px_1fr] gap-3 text-sm leading-6 text-[#92979a]">
                  <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-[#aeb2b4]">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Request body</h2>
              <code className="text-xs text-[#656b6f]">POST /v1/tools/{tool.slug}/call</code>
            </div>
            <div className="mt-4"><JsonBlock value={docs.invocation.call.requestExample} /></div>
          </div>
        </section>

        <section className="grid gap-8 border-t border-white/[0.075] py-12 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Input JSON Schema</h2>
            <p className="mb-4 mt-2 text-sm text-[#777d81]">The exact object accepted in the request&apos;s <code>input</code> field.</p>
            <JsonBlock value={(docs.invocation.call.requestSchema.properties as Record<string, unknown>)?.input ?? {}} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Normalized response</h2>
            <p className="mb-4 mt-2 text-sm text-[#777d81]">Every call returns the same envelope with this tool&apos;s output inside it.</p>
            <JsonBlock value={docs.invocation.call.responseExample} />
          </div>
        </section>

        <section className="border-t border-white/[0.075] py-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f6569]">Machine-readable</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Give the agent the format it prefers.</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a href={docs.documentation.json} className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-4 py-2 text-[#c4c7c9] hover:bg-white/[0.07]">JSON docs</a>
              <a href={docs.documentation.openapi} className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-4 py-2 text-[#c4c7c9] hover:bg-white/[0.07]">OpenAPI</a>
              <a href={docs.documentation.llms} className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-4 py-2 text-[#c4c7c9] hover:bg-white/[0.07]">llms.txt</a>
            </div>
          </div>
        </section>
        <PublicReviews identifier={slug} dark />
      </div>
    </main>
  );
}
