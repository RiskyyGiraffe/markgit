import { getLedger, getWallet } from "@/actions/wallet";
import { FundWalletDialog } from "@/components/fund-wallet-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle } from "lucide-react";

const usd = (value: string, digits = 2) => `$${Number(value).toFixed(digits)}`;

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const [wallet, ledger, params] = await Promise.all([getWallet(), getLedger(), searchParams]);
  return (
    <div>
      {params.payment === "success" ? <Alert className="mb-6"><CheckCircle2 className="size-4 text-emerald-600" /><AlertDescription>Payment successful. Your balance updates after confirmation.</AlertDescription></Alert> : null}
      {params.payment === "cancelled" ? <Alert variant="destructive" className="mb-6"><XCircle className="size-4" /><AlertDescription>Payment was cancelled. No funds were charged.</AlertDescription></Alert> : null}

      <section className="flex flex-col gap-6 border-b pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-medium text-muted-foreground">Account</p><h1 className="mt-2 font-display text-3xl font-medium tracking-[-0.045em] sm:text-[38px]">Wallet</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">One balance shared by the web portal, CLI, and every linked agent.</p></div>
        <FundWalletDialog />
      </section>

      <section className="grid gap-px overflow-hidden border-b bg-border py-0 sm:grid-cols-3">
        {[{ label: "Balance", value: wallet.balance, note: "Total funds" }, { label: "Available", value: wallet.available, note: "Agent-call capacity" }, { label: "Held", value: wallet.heldAmount, note: "Pending calls" }].map((item) => <div key={item.label} className="bg-background px-1 py-8 sm:px-6"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-2 font-display text-3xl font-medium tracking-[-0.04em]">{usd(item.value)}</p><p className="mt-2 text-xs text-muted-foreground">{item.note}</p></div>)}
      </section>

      <section className="pt-9">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Ledger</h2><span className="text-xs text-muted-foreground">{ledger.total} entries</span></div>
        <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          {ledger.entries.length === 0 ? <p className="px-6 py-16 text-center text-sm text-muted-foreground">No transactions yet.</p> : <Table><TableHeader><TableRow className="bg-muted/35 hover:bg-muted/35"><TableHead className="px-4">Type</TableHead><TableHead>Amount</TableHead><TableHead>Balance after</TableHead><TableHead>Description</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{ledger.entries.map((entry) => {
            const positive = entry.entryType === "credit" || entry.entryType === "release";
            return <TableRow key={entry.id}><TableCell className="px-4"><Badge variant="secondary" className="capitalize">{entry.entryType}</Badge></TableCell><TableCell className={positive ? "text-emerald-700" : "text-foreground"}>{positive ? "+" : "−"}{usd(entry.amountUsd, 4)}</TableCell><TableCell>{usd(entry.balanceAfterUsd, 4)}</TableCell><TableCell className="text-sm text-muted-foreground">{entry.description ?? "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</TableCell></TableRow>;
          })}</TableBody></Table>}
        </div>
      </section>
    </div>
  );
}
