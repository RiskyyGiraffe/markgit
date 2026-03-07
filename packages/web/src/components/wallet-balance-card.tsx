import type { WalletBalance } from "@tolty/sdk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WalletBalanceCard({ wallet }: { wallet: WalletBalance }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Wallet Balance</CardDescription>
        <CardTitle className="text-2xl">
          ${parseFloat(wallet.balance).toFixed(2)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Held: ${parseFloat(wallet.heldAmount).toFixed(2)}</span>
          <span>Available: ${parseFloat(wallet.available).toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
