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
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "running":
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
    case "timed_out":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/60";
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
        <Card className="rounded-[32px] border-black/10 bg-white/90 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl space-y-4">
                  <Badge className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-black/60 hover:bg-black/[0.03]">
                    Command center
                  </Badge>
                  <div className="space-y-3">
                    <h1 className="font-display text-4xl font-medium tracking-[-0.05em] text-black sm:text-5xl">
                      Operate your marketplace without the stale dashboard
                      chrome.
                    </h1>
                    <p className="max-w-xl text-[15px] leading-7 text-black/60 sm:text-base">
                      Wallet capacity, purchases, executions, and provider
                      actions are surfaced in one denser workspace with less
                      filler and more signal.
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-black/8 bg-[#f5f5f1] p-5 shadow-inner">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/45">
                    Wallet runway
                  </div>
                  <div className="mt-3 font-display text-4xl tracking-[-0.05em] text-black">
                    {formatUsd(wallet.available)}
                  </div>
                  <div className="mt-2 text-sm text-black/55">
                    Ready for executions and new product purchases.
                  </div>
                  <div className="mt-5 flex items-center gap-2 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-black/70">
                    <Sparkles className="size-4 text-emerald-600" />
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
                      className="rounded-[24px] border border-black/8 bg-[#f7f7f4] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/45">
                          {stat.label}
                        </div>
                        <Icon className="size-4 text-black/35" />
                      </div>
                      <div className="mt-4 font-display text-3xl tracking-[-0.05em] text-black">
                        {stat.value}
                      </div>
                      <div className="mt-2 text-sm text-black/55">{stat.meta}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-black/10 bg-white/90 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/40">
                  Quick launch
                </div>
                <h2 className="font-display text-3xl tracking-[-0.05em] text-black">
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
                      className="flex items-start justify-between rounded-[24px] border border-black/8 bg-[#f7f7f4] p-4 transition hover:-translate-y-0.5 hover:border-black/15 hover:bg-white"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-black">
                          <Icon className="size-4 text-black/45" />
                          {item.title}
                        </div>
                        <p className="text-sm leading-6 text-black/55">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-4 text-black/35" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[32px] border-black/10 bg-white/90 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/40">
                  Recent activity
                </div>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.05em] text-black">
                  Latest purchases and runs
                </h2>
              </div>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-black/10 bg-white text-black hover:bg-[#f7f7f4]"
              >
                <Link href="/history">Open history</Link>
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-[#f7f7f4] px-4 py-10 text-center text-sm text-black/50">
                  No activity yet. Start with a marketplace purchase or provider
                  listing.
                </div>
              ) : (
                recentActivity.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex flex-col gap-3 rounded-[24px] border border-black/8 bg-[#f7f7f4] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/40">
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
                      <div className="text-base font-medium text-black">
                        {item.title}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-black/55">
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

        <Card className="rounded-[32px] border-black/10 bg-white/90 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-5">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/40">
                  Workflow map
                </div>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.05em] text-black">
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
                    className="block rounded-[24px] border border-black/8 bg-[#f7f7f4] p-4 transition hover:bg-white"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex size-8 items-center justify-center rounded-full border border-black/10 bg-white font-mono text-[11px] text-black/55">
                        0{index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-black">
                          {item.title}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-black/55">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="rounded-[24px] border border-black/8 bg-black px-4 py-4 text-white">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
                  Current state
                </div>
                <div className="mt-3 text-sm leading-7 text-white/80">
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
