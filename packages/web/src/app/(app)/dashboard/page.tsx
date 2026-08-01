import Link from "next/link";
import { ArrowRight, Clock3, Plus, Wallet } from "lucide-react";
import { getWallet } from "@/actions/wallet";
import { getQuicklist } from "@/actions/quicklist";
import { listExecutions, listPurchases } from "@/actions/purchases";
import { QuicklistControl } from "@/components/quicklist-control";
import { ToolLogo } from "@/components/tool-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const usd = (value: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));

export default async function DashboardPage() {
  const [wallet, quicklist, purchases, executions] = await Promise.all([
    getWallet(),
    getQuicklist(),
    listPurchases(),
    listExecutions(),
  ]);

  const activity = [
    ...purchases.results.map((item) => ({ id: `purchase-${item.id}`, name: item.productName, status: item.status, detail: usd(item.totalUsd), createdAt: item.createdAt })),
    ...executions.results.map((item) => ({ id: `execution-${item.id}`, name: item.productName, status: item.status, detail: "Tool call", createdAt: item.createdAt })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);

  return (
    <div>
      <section className="flex flex-col gap-6 border-b pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Your account</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Agent quicklist</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Tools saved online sync to every linked agent and CLI, including their explicit authorization status.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
          <Wallet className="size-4 text-muted-foreground" />
          <div><p className="text-[11px] text-muted-foreground">Available balance</p><p className="mt-0.5 text-sm font-semibold">{usd(wallet.available)}</p></div>
          <Button asChild size="sm" variant="outline" className="ml-3"><Link href="/wallet">Manage</Link></Button>
        </div>
      </section>

      <section className="pt-8">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-sm font-medium">Synced tools</h2><p className="mt-1 text-xs text-muted-foreground">Authorization remains subject to spend limits and endpoint trust.</p></div>
          <Button asChild size="sm"><Link href="/marketplace"><Plus /> Add tools</Link></Button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          {quicklist.entries.length === 0 ? (
            <div className="px-6 py-20 text-center"><p className="font-medium">Your quicklist is empty.</p><p className="mt-2 text-sm text-muted-foreground">Add a tool once and it appears for every agent linked to this account.</p><Button asChild className="mt-5" size="sm"><Link href="/marketplace">Browse tools</Link></Button></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="w-[42%] px-4">Tool</TableHead><TableHead>Provider</TableHead><TableHead>Price</TableHead><TableHead>Authorization</TableHead></TableRow></TableHeader>
              <TableBody>{quicklist.entries.map((entry) => (
                <TableRow key={entry.id} className="h-[76px]">
                  <TableCell className="px-4"><Link href={`/tools/${entry.tool.slug}`} className="flex items-center gap-3"><ToolLogo name={entry.tool.name} logoUrl={entry.tool.logoUrl} category={entry.tool.category} tags={entry.tool.tags} /><span className="min-w-0"><span className="block truncate font-medium">{entry.tool.name}</span><span className="mt-1 block max-w-sm truncate text-xs text-muted-foreground">{entry.tool.description}</span></span></Link></TableCell>
                  <TableCell><span className="text-sm">{entry.tool.provider.name}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{entry.tool.provider.trustTier}</span></TableCell>
                  <TableCell><Badge variant="outline">{entry.tool.pricing.type === "free" ? "Free" : `$${entry.tool.pricing.amount} / call`}</Badge></TableCell>
                  <TableCell><QuicklistControl slug={entry.tool.slug} initialMode={entry.authorization.mode} versionCurrent={entry.authorization.versionCurrent} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="pt-10">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Recent account activity</h2><Link href="/history" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Full history <ArrowRight className="size-3.5" /></Link></div>
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          {activity.length === 0 ? <p className="px-5 py-12 text-center text-sm text-muted-foreground">No calls or purchases yet.</p> : <Table><TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="px-4">Tool</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{activity.map((item) => <TableRow key={item.id}><TableCell className="px-4 font-medium">{item.name}</TableCell><TableCell><Badge variant="secondary" className="capitalize">{item.status}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{item.detail}</TableCell><TableCell className="text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{new Date(item.createdAt).toLocaleString()}</span></TableCell></TableRow>)}</TableBody></Table>}
        </div>
      </section>
    </div>
  );
}
