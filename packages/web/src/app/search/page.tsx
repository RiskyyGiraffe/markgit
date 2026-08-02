import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { searchPublicRegistry } from "@/lib/public-registry";

type Kind = "tool" | "harness" | "mcp" | "skill";

export const dynamic = "force-dynamic";

export default async function PublicSearch({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const { q = "", kind: rawKind } = await searchParams;
  const kind = (["tool", "harness", "mcp", "skill"] as string[]).includes(rawKind ?? "") ? rawKind as Kind : undefined;
  const registry = await searchPublicRegistry(q.trim(), kind);
  return <main className="min-h-screen bg-[#101213] text-[#f1f2f2]"><PublicHeader /><div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8">
    <h1 className="font-display text-4xl font-medium tracking-[-0.055em]">Search the whole registry</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#92979a]">Search names, documentation, input and return schemas, source markdown, declared MCP tools, skill instructions, and custom-loop behavior.</p>
    <form action="/search" className="mt-7 flex flex-col gap-2 sm:flex-row"><label className="flex h-11 flex-1 items-center rounded-xl border border-white/[0.11] bg-[#1b1e20] px-3"><Search className="size-4 text-[#777d81]" /><input name="q" defaultValue={q} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" placeholder="What does the agent need to accomplish?" /></label><select name="kind" defaultValue={kind ?? ""} className="h-11 rounded-xl border border-white/[0.11] bg-[#1b1e20] px-3 text-sm"><option value="">Everything</option><option value="tool">Tools</option><option value="harness">Custom loops</option><option value="mcp">MCPs</option><option value="skill">Skills</option></select><button className="h-11 rounded-xl bg-[#e7e9e9] px-5 text-sm font-medium text-[#101213]">Search</button></form>
    <div className="mt-7 flex justify-between text-xs text-[#777d81]"><span>{registry.total} matches</span><span>{registry.semantic ? "Semantic + full-document ranking" : "Full-document matching"}</span></div>
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">{registry.results.map((item) => <Link key={item.id} href={item.route} className="grid gap-3 border-b border-white/[0.07] p-4 last:border-0 hover:bg-white/[0.035] sm:grid-cols-[minmax(0,1fr)_120px_170px_24px] sm:items-center"><div className="flex min-w-0 items-center gap-3"><ToolLogo name={item.name} logoUrl={item.logoUrl} category={item.category} tags={item.tags} /><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{item.name}</span><span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] uppercase text-[#9ca2a5]">{item.kind === "harness" ? "loop" : item.kind}</span></div><p className="mt-1 truncate text-xs text-[#777d81]">{item.description}</p></div></div><span className="text-xs text-[#92979a]">{Number(item.pricePerCallUsd) === 0 ? "Free" : `$${item.pricePerCallUsd}/call`}</span><span className="text-xs text-[#777d81]">{item.reviews.total ? `${item.reviews.helpfulPercent}% helpful · ${item.reviews.total}` : "No reviews"} · {item.usage.usageCount} uses</span><ArrowUpRight className="size-4 text-[#777d81]" /></Link>)}</div>
  </div></main>;
}
