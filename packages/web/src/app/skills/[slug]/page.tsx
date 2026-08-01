import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Braces, ExternalLink, FileCode2, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ToolLogo } from "@/components/tool-logo";
import { Badge } from "@/components/ui/badge";
import { getPublicSkill, markgitApiUrl } from "@/lib/public-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const skill = await getPublicSkill(slug);
  return skill ? { title: `${skill.name} skill — markgit`, description: skill.description ?? undefined } : { title: "Skill not found — markgit" };
}

const clientLabel: Record<string, string> = { "agent-skills": "Agent Skills", codex: "Codex", "claude-code": "Claude Code" };

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skill = await getPublicSkill(slug);
  if (!skill) notFound();
  const commands = Object.entries(skill.installation.commands).filter((entry): entry is [string, string] => typeof entry[1] === "string");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
        <Link href="/skills" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> All skills</Link>
        <section className="mt-7 flex flex-col gap-6 border-b pb-9 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4"><ToolLogo name={skill.name} logoUrl={skill.logoUrl} category={skill.category ?? "skill"} tags={[...skill.tags, "skill"]} size="lg" /><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">{skill.name}</h1><Badge variant="outline">Free</Badge></div><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{skill.description}</p><div className="mt-4 flex flex-wrap gap-2">{skill.compatibility.map((client) => <Badge key={client} variant="secondary">{clientLabel[client] ?? client}</Badge>)}</div></div></div>
          <a href={skill.source.url} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium hover:bg-muted">Source <ExternalLink className="size-3.5" /></a>
        </section>

        <div className="grid gap-5 pt-8 md:grid-cols-[1.4fr_0.8fr]">
          <section className="space-y-5">
            <div className="rounded-xl border bg-card p-5"><h2 className="flex items-center gap-2 text-sm font-medium"><FileCode2 className="size-4" /> Installation</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Commands are copied from or derived from the source publisher&apos;s documented installation flow. Markgit never runs them automatically.</p>{commands.length ? <div className="mt-4 space-y-3">{commands.map(([client, command]) => <div key={client}><p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{clientLabel[client] ?? client}</p><pre className="overflow-auto rounded-lg bg-muted p-3 text-xs"><code>{command}</code></pre></div>)}</div> : <p className="mt-4 text-sm">Follow the source repository&apos;s installation instructions.</p>}</div>
            <div className="rounded-xl border bg-card p-5"><h2 className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4" /> Provenance and safety</h2><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">Publisher</dt><dd className="mt-1">{skill.provenance.publisher ?? skill.provider.name}</dd></div><div><dt className="text-muted-foreground">Revision</dt><dd className="mt-1 font-mono">{skill.provenance.revision}</dd></div><div className="sm:col-span-2"><dt className="text-muted-foreground">Repository</dt><dd className="mt-1 break-all"><a href={skill.provenance.repository} className="hover:underline">{skill.provenance.repository}</a></dd></div></dl><p className="mt-4 border-t pt-4 text-xs leading-5 text-muted-foreground">Review SKILL.md, bundled scripts, references, assets, and the license before installation. Source provenance is not a security audit.</p></div>
          </section>
          <aside className="space-y-5">
            <div className="rounded-xl border bg-card p-5"><h2 className="text-sm font-medium">Package</h2><dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Format</dt><dd>{skill.format}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Entrypoint</dt><dd className="font-mono">{skill.entrypoint}</dd></div>{Object.entries(skill.contents).map(([name, present]) => <div key={name} className="flex justify-between gap-3"><dt className="capitalize text-muted-foreground">{name}</dt><dd>{present ? "Included" : "None"}</dd></div>)}</dl></div>
            <div className="rounded-xl border bg-card p-5"><h2 className="text-sm font-medium">Agent metadata</h2><div className="mt-4 space-y-2"><a href={`${markgitApiUrl}/v1/registry/skills/${skill.slug}/docs`} className="flex items-center gap-2 text-xs hover:underline"><Braces className="size-3.5" /> JSON docs</a><a href={`${markgitApiUrl}/v1/registry/skills/${skill.slug}/llms.txt`} className="flex items-center gap-2 text-xs hover:underline"><Braces className="size-3.5" /> llms.txt</a></div></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
