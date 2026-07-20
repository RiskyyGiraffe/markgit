import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Braces, ExternalLink, ShieldCheck, Users, Zap } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
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
    <pre className="max-h-[520px] overflow-auto rounded-2xl border border-black/8 bg-[#171714] p-5 text-xs leading-6 text-white/78 sm:text-[13px]">
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
    <main className="min-h-screen bg-[#f8f8f5] text-[#171714]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm text-black/45 hover:text-black">
          <ArrowLeft className="size-4" /> All tools
        </Link>

        <section className="mt-8 border-b border-black/10 pb-10">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-black/45">
                <span>{tool.category ?? "Tool"}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" /> {tool.provider.name}
                </span>
              </div>
              <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.055em] sm:text-5xl">{tool.name}</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-black/55">{tool.description ?? "No description provided."}</p>
            </div>
            <div className="min-w-48 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-black/35">Price</p>
              <p className="mt-2 font-mono text-lg font-semibold">{price}</p>
              <p className="mt-4 text-xs leading-5 text-black/42">The exact total and Markgit fee are returned before every paid call.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-black/55">
              <Users className="size-3.5" /> {tool.usage.usersLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-black/55">
              <Zap className="size-3.5" /> {tool.usage.invocationsLabel}
            </span>
            <a href={docs.documentation.llms} className="inline-flex items-center gap-2 rounded-full bg-[#171714] px-3 py-2 text-xs text-white hover:bg-black/80">
              <Bot className="size-3.5" /> LLM docs <ExternalLink className="size-3" />
            </a>
            <a href={docs.documentation.openapi} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-black/55 hover:text-black">
              <Braces className="size-3.5" /> OpenAPI 3.1 <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="mt-3 text-[11px] text-black/35">Usage covers successful calls made through Markgit; direct provider calls are not observable.</p>
        </section>

        <section className="grid gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Agent flow</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Quote, approve, call.</h2>
            <ol className="mt-6 space-y-4">
              {docs.invocation.flow.map((step, index) => (
                <li key={step} className="grid grid-cols-[28px_1fr] gap-3 text-sm leading-6 text-black/55">
                  <span className="flex size-7 items-center justify-center rounded-full bg-black/[0.055] text-xs font-medium text-black/55">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Request body</h2>
              <code className="text-xs text-black/38">POST /v1/tools/{tool.slug}/call</code>
            </div>
            <div className="mt-4"><JsonBlock value={docs.invocation.call.requestExample} /></div>
          </div>
        </section>

        <section className="grid gap-8 border-t border-black/10 py-12 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Input JSON Schema</h2>
            <p className="mb-4 mt-2 text-sm text-black/45">The exact object accepted in the request&apos;s <code>input</code> field.</p>
            <JsonBlock value={(docs.invocation.call.requestSchema.properties as Record<string, unknown>)?.input ?? {}} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Normalized response</h2>
            <p className="mb-4 mt-2 text-sm text-black/45">Every call returns the same envelope with this tool&apos;s output inside it.</p>
            <JsonBlock value={docs.invocation.call.responseExample} />
          </div>
        </section>

        <section className="border-t border-black/10 py-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">Machine-readable</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Give the agent the format it prefers.</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a href={docs.documentation.json} className="rounded-full border border-black/10 bg-white px-4 py-2 hover:border-black/25">JSON docs</a>
              <a href={docs.documentation.openapi} className="rounded-full border border-black/10 bg-white px-4 py-2 hover:border-black/25">OpenAPI</a>
              <a href={docs.documentation.llms} className="rounded-full border border-black/10 bg-white px-4 py-2 hover:border-black/25">llms.txt</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
