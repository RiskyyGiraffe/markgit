import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Braces, Check, ExternalLink, LockKeyhole, Server } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { Badge } from "@/components/ui/badge";
import { getPublicMcp, markgitApiUrl } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mcp = await getPublicMcp(slug);
  return mcp ? { title: `${mcp.name} MCP — markgit`, description: mcp.description ?? undefined } : { title: "MCP not found — markgit" };
}

export default async function McpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mcp = await getPublicMcp(slug);
  if (!mcp) notFound();
  const config = JSON.stringify({ type: mcp.connect.transport.replace("_", "-"), url: mcp.connect.url }, null, 2);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-9 sm:px-8 sm:pt-12">
        <Link href="/mcps" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All MCPs</Link>
        <section className="mt-8 grid gap-8 border-b pb-10 md:grid-cols-[1fr_280px]">
          <div><div className="flex items-start gap-4"><ToolLogo name={mcp.name} logoUrl={mcp.logoUrl} category={mcp.category} tags={mcp.tags} size="lg" /><div><p className="text-xs text-muted-foreground">MCP · {mcp.provider.name}</p><h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-4xl">{mcp.name}</h1></div></div><p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground">{mcp.description}</p><div className="mt-5 flex flex-wrap gap-2"><Badge variant="secondary">{mcp.trust.endpoint.status} endpoint</Badge><Badge variant="secondary">{mcp.risk.level} risk</Badge><Badge variant="secondary">{mcp.server.transport.replaceAll("_", " ")}</Badge><Badge variant="secondary">Free through Markgit</Badge></div></div>
          <div className="rounded-xl border bg-card p-5 shadow-sm"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Direct connection</p><p className="mt-3 break-all font-mono text-xs leading-6">{mcp.server.url}</p><p className="mt-3 text-xs text-muted-foreground">Auth: {mcp.server.auth.mode.replaceAll("_", " ")}</p>{mcp.server.auth.instructionsUrl ? <a href={mcp.server.auth.instructionsUrl} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium hover:underline">Authentication guide <ExternalLink className="size-3" /></a> : null}</div>
        </section>
        <section className="grid gap-8 py-10 lg:grid-cols-[1.1fr_.9fr]">
          <div><div className="flex items-center gap-2"><Bot className="size-4" /><h2 className="text-lg font-medium">Declared tools</h2></div><div className="mt-4 overflow-hidden rounded-xl border bg-card">{mcp.features.tools.length ? mcp.features.tools.map((tool) => <div key={tool.name} className="border-b px-4 py-3 last:border-0"><div className="font-mono text-sm font-medium">{tool.name}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description ?? "No description provided."}</p></div>) : <p className="p-5 text-sm text-muted-foreground">No tools declared.</p>}</div><div className="mt-4 flex gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Resources {mcp.features.resources ? "supported" : "not declared"}</span><span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Prompts {mcp.features.prompts ? "supported" : "not declared"}</span></div></div>
          <div className="space-y-4"><div className="rounded-xl border bg-card p-5"><h2 className="flex items-center gap-2 text-sm font-medium"><Server className="size-4" /> Client configuration</h2><pre className="mt-4 overflow-auto rounded-lg bg-muted p-4 text-xs leading-6"><code>{config}</code></pre></div><div className="rounded-xl border bg-card p-5"><h2 className="flex items-center gap-2 text-sm font-medium"><LockKeyhole className="size-4" /> Trust boundary</h2><p className="mt-3 text-xs leading-6 text-muted-foreground">Your client connects directly to the provider. Markgit versions this listing and verifies the published origin, but never sees or proxies MCP traffic.</p></div><div className="flex gap-2"><a href={`${markgitApiUrl}/v1/registry/mcps/${mcp.slug}/docs`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"><Braces className="size-3.5" /> JSON docs</a><a href={`${markgitApiUrl}/v1/registry/mcps/${mcp.slug}/llms.txt`} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"><Bot className="size-3.5" /> LLM docs</a></div></div>
        </section>
      </div>
    </main>
  );
}
