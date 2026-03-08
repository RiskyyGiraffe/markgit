import Link from "next/link";
import { getWallet } from "@/actions/wallet";
import { listPurchases, listExecutions } from "@/actions/purchases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Clock3,
  CreditCard,
  History,
  Layers3,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  Workflow,
} from "lucide-react";

function formatUsd(value: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(parseFloat(value));
}

function activityTone(status: string) {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "running":
    case "pending":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "failed":
    case "timed_out":
      return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    default:
      return "border-border/60 bg-muted/70 text-muted-foreground";
  }
}

export default async function DashboardPage() {
  const [wallet, purchases, executions] = await Promise.all([
    getWallet(),
    listPurchases(),
    listExecutions(),
  ]);

  const recentActivity = [
    ...purchases.results.slice(0, 4).map((purchase) => ({
      id: purchase.id,
      type: "Purchase",
      title: purchase.productName,
      status: purchase.status,
      meta: formatUsd(purchase.totalUsd),
      createdAt: purchase.createdAt,
    })),
    ...executions.results.slice(0, 4).map((execution) => ({
      id: execution.id,
      type: "Execution",
      title: execution.productName,
      status: execution.status,
      meta: "Run logged",
      createdAt: execution.createdAt,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 6);

  const stats = [
    {
      label: "Wallet balance",
      value: formatUsd(wallet.balance),
      meta: `Held ${formatUsd(wallet.heldAmount)}`,
      icon: Wallet,
    },
    {
      label: "Available now",
      value: formatUsd(wallet.available),
      meta: "Ready for new purchases",
      icon: CreditCard,
    },
    {
      label: "Purchases",
      value: purchases.total.toString(),
      meta: "Purchased products",
      icon: Layers3,
    },
    {
      label: "Executions",
      value: executions.total.toString(),
      meta: "Total workflow runs",
      icon: Workflow,
    },
  ];

  const quickLinks = [
    {
      title: "Browse marketplace",
      description: "Find new agents and execution-ready products.",
      href: "/marketplace",
      icon: Store,
    },
    {
      title: "Review history",
      description: "Inspect purchase flow and execution traces.",
      href: "/history",
      icon: History,
    },
    {
      title: "Manage provider profile",
      description: "Update listings, payout setup, and product config.",
      href: "/provider",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[32px] border-border/60 bg-card/90 shadow-sm backdrop-blur">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl space-y-4">
                  <Badge className="rounded-full border border-border/60 bg-muted/70 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground hover:bg-muted/70">
                    Command center
                  </Badge>
                  <div className="space-y-3">
                    <h1 className="font-display text-4xl font-medium tracking-[-0.05em] text-foreground sm:text-5xl">
                      Operate your marketplace without the stale dashboard
                      chrome.
                    </h1>
                    <p className="max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-base">
                      Wallet capacity, purchases, executions, and provider
                      actions are surfaced in one denser workspace with less
                      filler and more signal.
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-border/60 bg-muted/60 p-5 shadow-inner">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Wallet runway
                  </div>
                  <div className="mt-3 font-display text-4xl tracking-[-0.05em] text-foreground">
                    {formatUsd(wallet.available)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Ready for executions and new product purchases.
                  </div>
                  <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                    <Sparkles className="size-4 text-emerald-500 dark:text-emerald-400" />
                    Held balance: {formatUsd(wallet.heldAmount)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="rounded-[24px] border border-border/60 bg-muted/60 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {stat.label}
                        </div>
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="mt-4 font-display text-3xl tracking-[-0.05em] text-foreground">
                        {stat.value}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {stat.meta}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border/60 bg-card/90 shadow-sm backdrop-blur">
          <CardContent className="p-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Quick launch
                </div>
                <h2 className="font-display text-3xl tracking-[-0.05em] text-foreground">
                  Move between revenue surfaces quickly.
                </h2>
              </div>

              <div className="space-y-3">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-start justify-between rounded-[24px] border border-border/60 bg-muted/60 p-4 transition hover:-translate-y-0.5 hover:border-border hover:bg-accent/60"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Icon className="size-4 text-muted-foreground" />
                          {item.title}
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[32px] border-border/60 bg-card/90 shadow-sm backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Recent activity
                </div>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.05em] text-foreground">
                  Latest purchases and runs
                </h2>
              </div>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-border/60 bg-background text-foreground hover:bg-accent"
              >
                <Link href="/history">Open history</Link>
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/50 px-4 py-10 text-center text-sm text-muted-foreground">
                  No activity yet. Start with a marketplace purchase or provider
                  listing.
                </div>
              ) : (
                recentActivity.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex flex-col gap-3 rounded-[24px] border border-border/60 bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {item.type}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize",
                            activityTone(item.status)
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="text-base font-medium text-foreground">
                        {item.title}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div>{item.meta}</div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="size-4" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border/60 bg-card/90 shadow-sm backdrop-blur">
          <CardContent className="p-6">
            <div className="space-y-5">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Workflow map
                </div>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.05em] text-foreground">
                  The product areas that matter day to day
                </h2>
              </div>

              <div className="space-y-3">
                {[
                  {
                    title: "Wallet funding",
                    description: "Keep spendable balance ahead of execution demand.",
                    href: "/wallet",
                  },
                  {
                    title: "Marketplace sourcing",
                    description: "Discover new products and compare purchase paths.",
                    href: "/marketplace",
                  },
                  {
                    title: "Provider operations",
                    description: "Manage listings, config, payouts, and trust tier.",
                    href: "/provider",
                  },
                ].map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-[24px] border border-border/60 bg-muted/60 p-4 transition hover:bg-accent/60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex size-8 items-center justify-center rounded-full border border-border/60 bg-background font-mono text-[11px] text-muted-foreground">
                        0{index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {item.title}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="rounded-[24px] border border-border/60 bg-foreground px-4 py-4 text-background">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-background/60">
                  Current state
                </div>
                <div className="mt-3 text-sm leading-7 text-background/80">
                  {executions.total > 0
                    ? "Execution history is live. Use history for trace-level review and the marketplace to expand coverage."
                    : "No executions logged yet. Fund the wallet and purchase a product to start building operational history."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
