import { getWallet, getLedger } from "@/actions/wallet";
import { WalletBalanceCard } from "@/components/wallet-balance-card";
import { FundWalletDialog } from "@/components/fund-wallet-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const [wallet, ledger, params] = await Promise.all([
    getWallet(),
    getLedger(),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      {params.payment === "success" && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription>
            Payment successful! Your wallet balance will be updated shortly once
            the payment is confirmed.
          </AlertDescription>
        </Alert>
      )}
      {params.payment === "cancelled" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Payment was cancelled. No funds were charged.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">
            Manage your funds and view transactions
          </p>
        </div>
        <FundWalletDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <WalletBalanceCard wallet={wallet} />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Held</CardDescription>
            <CardTitle className="text-2xl">
              ${parseFloat(wallet.heldAmount).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Funds reserved for pending transactions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available</CardDescription>
            <CardTitle className="text-2xl">
              ${parseFloat(wallet.available).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Funds available for purchases
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>Transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge
                        variant={
                          entry.entryType === "credit"
                            ? "default"
                            : entry.entryType === "capture"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {entry.entryType}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={
                        entry.entryType === "credit" || entry.entryType === "release"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {entry.entryType === "credit" || entry.entryType === "release"
                        ? "+"
                        : "-"}
                      ${parseFloat(entry.amountUsd).toFixed(4)}
                    </TableCell>
                    <TableCell>
                      ${parseFloat(entry.balanceAfterUsd).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.description ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
