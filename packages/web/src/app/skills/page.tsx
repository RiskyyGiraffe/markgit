import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { CatalogTabs } from "@/components/catalog-tabs";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllPublicSkills } from "@/lib/public-registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skills — markgit", description: "Discover source-hosted SKILL.md packages with transparent provenance and compatibility." };

const clientLabel: Record<string, string> = { "agent-skills": "Agent Skills", codex: "Codex", "claude-code": "Claude Code" };

export default async function SkillsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const { skills } = await getAllPublicSkills(query);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <CatalogTabs active="skills" />
        <section className="pt-10">
          <h1 className="font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Skills</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Reusable SKILL.md packages hosted by their source publishers. Markgit indexes provenance and install guidance without executing the package.</p>
          <form action="/skills" className="mt-7 flex h-11 items-center rounded-xl border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/20"><Search className="size-4 text-muted-foreground" /><input name="q" type="search" defaultValue={query} placeholder="Search skills" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground" /></form>
        </section>

        <div className="mt-8 flex items-center justify-between"><h2 className="text-sm font-medium">Public skills</h2><span className="text-xs text-muted-foreground">{skills.length} listed</span></div>
        <section className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          {skills.length === 0 ? <div className="px-6 py-20 text-center"><p className="font-medium">No skills found.</p><p className="mt-2 text-sm text-muted-foreground">Try a broader workflow or client name.</p></div> : (
            <Table>
              <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="w-[42%] px-4">Skill</TableHead><TableHead>Source</TableHead><TableHead>Works with</TableHead><TableHead>Contents</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>{skills.map((skill) => {
                const contents = Object.entries(skill.contents).filter(([, present]) => present).map(([name]) => name);
                return <TableRow key={skill.id} className="group h-[76px]">
                  <TableCell className="px-4 py-3"><Link href={`/skills/${skill.slug}`} className="flex items-center gap-3"><ToolLogo name={skill.name} logoUrl={skill.logoUrl} category={skill.category ?? "skill"} tags={[...skill.tags, "skill"]} /><span className="min-w-0"><span className="block truncate font-medium">{skill.name}</span><span className="mt-1 block max-w-sm truncate text-xs text-muted-foreground">{skill.description}</span></span></Link></TableCell>
                  <TableCell><span className="text-sm">{skill.provenance.publisher ?? skill.provider.name}</span><span className="mt-1 block text-xs text-muted-foreground">{new URL(skill.provenance.repository).hostname}</span></TableCell>
                  <TableCell><span className="text-xs">{skill.compatibility.map((client) => clientLabel[client] ?? client).join(" · ")}</span></TableCell>
                  <TableCell><span className="text-xs capitalize">{contents.length ? contents.join(" · ") : "Instructions only"}</span><span className="mt-1 block text-xs text-muted-foreground">Free · source hosted</span></TableCell>
                  <TableCell><Link href={`/skills/${skill.slug}`} aria-label={`View ${skill.name}`}><ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" /></Link></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}
