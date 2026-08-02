import type { Metadata } from "next";
import type { LeaderboardEntry, LeaderboardResponse } from "@markgit/sdk";
import Link from "next/link";
import { ExternalLink, Trophy } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPublicLeaderboard } from "@/lib/public-registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboard — markgit", description: "Transparent rankings for Markgit tools, custom loops, MCP servers, and agent skills." };

const sections: Array<{ key: keyof LeaderboardResponse["categories"]; title: string; note: string }> = [
  { key: "tools", title: "Tools", note: "Completed calls observed by Markgit" },
  { key: "harnesses", title: "Custom Loops", note: "Runs observed by Markgit" },
  { key: "mcps", title: "MCP servers", note: "Current stars on the indexed first-party source" },
  { key: "skills", title: "Skills", note: "Current stars on the indexed source repository" },
];

const kindPath = { tool: "tools", harness: "harnesses", mcp: "mcps", skill: "skills" } as const;
const hrefFor = (entry: LeaderboardEntry) => `/${kindPath[entry.kind]}/${entry.slug}`;

export default async function LeaderboardPage() {
  const leaderboard = await getPublicLeaderboard(25);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <section className="border-b pb-9">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"><Trophy className="size-4" /> Transparent rankings</div>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Leaderboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Each category is ranked independently using a metric Markgit can substantiate. Direct MCP traffic and off-platform skill installs are never presented as Markgit usage.</p>
        </section>

        <div className="mt-10 space-y-12">
          {sections.map((section) => {
            const entries = leaderboard?.categories[section.key].entries ?? [];
            return <section key={section.key}>
              <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-medium">{section.title}</h2><p className="mt-1 text-xs text-muted-foreground">{section.note}</p></div><Link href={`/${section.key}`} className="text-xs text-muted-foreground hover:text-foreground">View all</Link></div>
              <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
                {entries.length ? <Table>
                  <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="w-14 text-center">#</TableHead><TableHead>Listing</TableHead><TableHead>Provider</TableHead><TableHead className="text-right">Ranking signal</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                  <TableBody>{entries.map((entry) => <TableRow key={entry.id} className="h-[72px]">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{entry.rank}</TableCell>
                    <TableCell><Link href={hrefFor(entry)} className="flex items-center gap-3"><ToolLogo name={entry.name} logoUrl={entry.logoUrl} category={entry.kind} tags={[entry.kind]} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{entry.name}</span><span className="mt-1 block max-w-md truncate text-xs text-muted-foreground">{entry.description}</span></span></Link></TableCell>
                    <TableCell className="text-xs">{entry.provider}</TableCell>
                    <TableCell className="text-right text-xs font-medium"><span className="block">{entry.reviews.total ? `${entry.reviews.helpfulPercent}% helpful · ${entry.reviews.total} reviews` : "No agent reviews"}</span><span className="mt-1 block font-normal text-muted-foreground">{entry.metricLabel}</span></TableCell>
                    <TableCell>{entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${entry.name} source`}><ExternalLink className="size-3.5 text-muted-foreground" /></a> : null}</TableCell>
                  </TableRow>)}</TableBody>
                </Table> : <p className="p-8 text-center text-sm text-muted-foreground">No active listings yet.</p>}
              </div>
            </section>;
          })}
        </div>
        <p className="mt-10 border-t pt-6 text-xs leading-5 text-muted-foreground">Verified-use helpful votes rank first using a confidence-adjusted score. One account has one current review per listing, and feedback collected during a task becomes a single consolidated review. GitHub stars remain a fallback source-popularity signal, not an endorsement.</p>
      </div>
    </main>
  );
}
