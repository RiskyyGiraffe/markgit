import {
  getStripeStatus,
  getEarningsSummary,
  listEarnings,
  listPayouts,
} from "@/actions/provider";
import { StripeConnectButton } from "@/components/stripe-connect-button";
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

export default async function ProviderPage() {
  let stripeStatus: { accountId: string | null; status: string };
  let earnings: {
    totalGross: string;
    totalFees: string;
    totalNet: string;
    unpaid: string;
    paidOut: string;
  };
  let earningsLog: {
    results: Array<{
      id: string;
      purchaseId: string;
      productName: string;
      grossAmountUsd: string;
      toltyFeeUsd: string;
      netAmountUsd: string;
      payoutId: string | null;
      createdAt: string;
    }>;
  };
  let payoutHistory: {
    results: Array<{
      id: string;
      amountUsd: string;
      status: string;
      stripeTransferId: string | null;
      createdAt: string;
    }>;
  };

  try {
    [stripeStatus, earnings, earningsLog, payoutHistory] = await Promise.all([
      getStripeStatus(),
      getEarningsSummary(),
      listEarnings(),
      listPayouts(),
    ]);
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider</h1>
          <p className="text-muted-foreground">
            You need to be registered as a provider to access this page.
          </p>
        </div>
      </div>
    );
  }

  const isConnected = stripeStatus.status === "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Provider</h1>
        <p className="text-muted-foreground">
          Earnings, API call history, and payouts
        </p>
      </div>

      {/* Stripe Status */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe Account</CardTitle>
          <CardDescription>
            {isConnected
              ? "Your Stripe account is connected. Payouts are sent daily."
              : "Connect your Stripe account to receive payouts"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status:</span>
              <Badge
                variant={
                  stripeStatus.status === "active"
                    ? "default"
                    : stripeStatus.status === "pending"
                      ? "secondary"
                      : "destructive"
                }
              >
                {stripeStatus.status}
              </Badge>
            </div>
            {!isConnected && <StripeConnectButton />}
          </div>
        </CardContent>
      </Card>

      {/* Earnings Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Gross</CardDescription>
            <CardTitle className="text-2xl">
              ${parseFloat(earnings.totalGross).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platform Fees</CardDescription>
            <CardTitle className="text-2xl">
              ${parseFloat(earnings.totalFees).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Payout</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              ${parseFloat(earnings.unpaid).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Paid out daily at midnight UTC
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid Out</CardDescription>
            <CardTitle className="text-2xl">
              ${parseFloat(earnings.paidOut).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Per-Call Earnings Log */}
      <Card>
        <CardHeader>
          <CardTitle>API Call Earnings</CardTitle>
          <CardDescription>Revenue from each API call to your products</CardDescription>
        </CardHeader>
        <CardContent>
          {earningsLog.results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No API calls yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earningsLog.results.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.productName}
                    </TableCell>
                    <TableCell>
                      ${parseFloat(entry.grossAmountUsd).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      -${parseFloat(entry.toltyFeeUsd).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-green-600">
                      ${parseFloat(entry.netAmountUsd).toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.payoutId ? "default" : "secondary"}>
                        {entry.payoutId ? "paid" : "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Daily automatic payouts to your Stripe account</CardDescription>
        </CardHeader>
        <CardContent>
          {payoutHistory.results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payouts yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transfer ID</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutHistory.results.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      ${parseFloat(payout.amountUsd).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payout.status === "completed"
                            ? "default"
                            : payout.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {payout.stripeTransferId ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(payout.createdAt).toLocaleDateString()}
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
