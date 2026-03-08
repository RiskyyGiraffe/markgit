import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CircleDollarSign,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InstallCommandCard } from "@/components/install-command-card";

const heroStats = [
  { label: "Curated agents", value: "240+" },
  { label: "Live executions", value: "18.2k" },
  { label: "Provider payout rate", value: "99.3%" },
];

const featuredAgents = [
  {
    name: "Lead Enrichment",
    category: "Sales",
    accent: "from-cyan-400/40 via-sky-500/20 to-transparent",
  },
  {
    name: "Doc Analyst",
    category: "Research",
    accent: "from-violet-400/35 via-fuchsia-500/15 to-transparent",
  },
  {
    name: "Ops Copilot",
    category: "Support",
    accent: "from-emerald-400/35 via-teal-500/15 to-transparent",
  },
  {
    name: "Risk Watch",
    category: "Security",
    accent: "from-amber-300/30 via-orange-500/10 to-transparent",
  },
  {
    name: "Creative Studio",
    category: "Content",
    accent: "from-pink-400/35 via-rose-500/15 to-transparent",
  },
  {
    name: "Data Router",
    category: "Infra",
    accent: "from-blue-400/35 via-indigo-500/15 to-transparent",
  },
];

const valuePillars = [
  {
    title: "Discover faster",
    description:
      "Search verified agents by category, pricing model, response shape, and execution guarantees.",
    icon: Search,
  },
  {
    title: "Launch safely",
    description:
      "Use wallet balances, purchase history, and transparent run logs before committing production traffic.",
    icon: ShieldCheck,
  },
  {
    title: "Monetize cleanly",
    description:
      "Publish once, define price per call, and let providers track payouts without building billing rails.",
    icon: CircleDollarSign,
  },
];

const marketplaceCategories = [
  "Research agents",
  "Growth agents",
  "Internal ops",
  "Support automations",
  "Financial workflows",
  "Developer tooling",
];

const launchSteps = [
  {
    title: "Find the right agent",
    description:
      "Browse marketplace inventory with tags, pricing, and outcome summaries tailored to teams evaluating quickly.",
  },
  {
    title: "Validate the workflow",
    description:
      "Inspect inputs and outputs, compare providers, and verify execution behavior before routing real jobs.",
  },
  {
    title: "Scale transactions",
    description:
      "Fund a wallet, execute on demand, and track every purchase and run from one operational surface.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-white/70 hover:bg-white/5">
        {eyebrow}
      </Badge>
      <div className="space-y-2.5">
        <h2 className="font-display text-2xl font-medium tracking-[-0.04em] text-white sm:text-3xl lg:text-4xl">
          {title}
        </h2>
        <p className="max-w-xl text-sm leading-6 text-white/60 sm:text-[15px] sm:leading-7">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 -z-10 h-[540px] bg-[radial-gradient(circle_at_top,rgba(41,121,255,0.22),transparent_44%),radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_22%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)]" />
        <div className="absolute left-1/2 top-24 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 sm:px-8">
          <Link
            href="/"
            className="font-display text-lg font-medium tracking-[-0.04em] text-white"
          >
            markgit
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-white/55 md:flex">
            <Link href="#marketplace" className="transition hover:text-white">
              Marketplace
            </Link>
            <Link href="#details" className="transition hover:text-white">
              Details
            </Link>
            <Link href="#providers" className="transition hover:text-white">
              Providers
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="hidden rounded-full text-white/70 hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-white px-5 text-black hover:bg-white/90"
            >
              <Link href="/login">
                Open markgit
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-14 pt-6 sm:px-8 sm:pb-16 sm:pt-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-12 lg:pb-20 lg:pt-10">
          <div className="max-w-[38rem] space-y-6">
            <div className="space-y-4">
              <Badge className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-100 hover:bg-cyan-400/10">
                Curated for modern agent commerce
              </Badge>
              <h1 className="max-w-3xl font-display text-4xl font-medium leading-[0.94] tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                markgit is the agent marketplace built to source, test, and ship AI work.
              </h1>
              <p className="max-w-xl text-[15px] leading-7 text-white/62 sm:text-base sm:leading-8">
                Discover production-ready agents on markgit, validate outcomes
                before you commit traffic, and let providers publish monetized
                workflows from one polished operating surface.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full bg-white px-5 text-sm font-medium text-black hover:bg-white/90"
              >
                <Link href="/login">
                  Explore agents
                  <Sparkles className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 rounded-full border-white/15 bg-white/[0.03] px-5 text-sm text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="#providers">
                  Publish as provider
                  <Store className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 backdrop-blur-sm"
                >
                  <div className="font-display text-2xl tracking-[-0.04em] text-white sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-white/50">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <Card className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[28px] border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_40px_120px_rgba(0,0,0,0.6)] lg:ml-auto">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-400/10 to-transparent" />
            <CardContent className="space-y-4 p-3 sm:p-5">
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/40 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="size-2 rounded-full bg-white/30" />
                    <span className="size-2 rounded-full bg-white/20" />
                    <span className="size-2 rounded-full bg-cyan-300/70" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.22em] text-white/40">
                    Marketplace preview
                  </span>
                </div>
                <Badge className="rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10">
                  Live inventory
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-[132px_1fr] xl:grid-cols-[132px_1fr_170px]">
                <div className="hidden rounded-[22px] border border-white/8 bg-black/45 p-3 md:block">
                  <div className="mb-4 flex items-center gap-2 text-sm text-white">
                    <Bot className="size-4 text-cyan-300" />
                    <span>Collections</span>
                  </div>
                  <div className="space-y-2">
                    {marketplaceCategories.map((category, index) => (
                      <div
                        key={category}
                        className={`rounded-xl px-3 py-2 text-sm ${
                          index === 0
                            ? "bg-cyan-400/12 text-cyan-100"
                            : "bg-white/[0.03] text-white/55"
                        }`}
                      >
                        {category}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {featuredAgents.map((agent, index) => (
                    <div
                      key={agent.name}
                      className="group relative overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.03] p-3.5 transition-transform duration-300 hover:-translate-y-1 sm:p-4"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${agent.accent}`}
                      />
                      <div className="relative space-y-5">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/55">
                          <span>{agent.category}</span>
                          <span>Ready</span>
                        </div>
                        <div className="space-y-3">
                          <div className="inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-white/70">
                            ${" "}
                            {(0.0025 + index * 0.0011).toFixed(4)}
                            /run
                          </div>
                          <div>
                            <div className="font-display text-xl tracking-[-0.04em] text-white sm:text-2xl">
                              {agent.name}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
                              <Workflow className="size-4" />
                              Structured output, usage logs, retry support
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden space-y-3 xl:block">
                  <div className="rounded-[22px] border border-white/8 bg-black/45 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                      Run queue
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        "Lead Enrichment",
                        "Doc Analyst",
                        "Risk Watch",
                      ].map((item, index) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span>{item}</span>
                            <span className="text-white/40">0{index + 1}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-white/5">
                            <div
                              className="h-1.5 rounded-full bg-cyan-300"
                              style={{ width: `${72 - index * 18}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <Wallet className="size-4 text-cyan-200" />
                      Wallet-ready purchasing
                    </div>
                    <div className="mt-5 font-display text-4xl tracking-[-0.05em]">
                      $12,480
                    </div>
                    <div className="mt-2 text-sm text-white/45">
                      Available balance powering purchase, execution, and payout
                      flows from a single ledger.
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <section className="mx-auto max-w-7xl px-6 pb-2 sm:px-8">
        <InstallCommandCard />
      </section>

      <section
        id="marketplace"
        className="mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.88fr_1.12fr]"
      >
        <SectionHeading
          eyebrow="Design and publish in one place"
          title="A marketplace front door on one side, provider console on the other."
          description="The landing page mirrors the product itself: sharper hierarchy, tighter spacing, and product previews that feel like the real interface instead of generic marketing blocks."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-[28px] border-white/10 bg-white/[0.03]">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-3 text-sm text-white/70">
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-2">
                  <Search className="size-4 text-cyan-200" />
                </div>
                Buyer workflow
              </div>
              <div className="space-y-3">
                <div className="font-display text-2xl tracking-[-0.05em] text-white sm:text-3xl">
                  Find the right outcome before the first API call.
                </div>
                <p className="text-sm leading-6 text-white/55">
                  Marketplace cards, pricing, tags, and verified metadata help
                  teams evaluate quickly without bouncing across docs and demo
                  links.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            id="providers"
            className="rounded-[28px] border-white/10 bg-white/[0.03]"
          >
            <CardContent className="p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-3 text-sm text-white/70">
                <div className="rounded-full border border-violet-400/20 bg-violet-400/10 p-2">
                  <Store className="size-4 text-violet-200" />
                </div>
                Provider workflow
              </div>
              <div className="space-y-3">
                <div className="font-display text-2xl tracking-[-0.05em] text-white sm:text-3xl">
                  Publish once, monetize every successful execution.
                </div>
                <p className="text-sm leading-6 text-white/55">
                  Providers manage catalog entries, execution configuration, and
                  payouts from a single console backed by wallet and purchase
                  primitives.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/10 bg-black/50 md:col-span-2">
            <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                      Provider editor
                    </div>
                    <div className="mt-2 font-display text-2xl tracking-[-0.04em]">
                      Creative Studio
                    </div>
                  </div>
                  <Badge className="rounded-full border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.04]">
                    $0.0085 per run
                  </Badge>
                </div>
                <div className="mt-6 grid gap-3 text-sm text-white/60 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                    Description
                    <div className="mt-2 text-white/40">
                      Image remix and branded asset generation with structured
                      outputs.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                    Execution config
                    <div className="mt-2 text-white/40">
                      Auth, retry policy, output schema, callback routing.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                  Commercial controls
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    "Price per call",
                    "Wallet settlement",
                    "Stripe payouts",
                    "Trust-tier controls",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/30 px-4 py-3"
                    >
                      <span className="text-sm text-white/70">{item}</span>
                      <Zap className="size-4 text-cyan-200" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="details" className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20">
        <SectionHeading
          eyebrow="The beauty is in the details"
          title="Every surface is tuned for confidence, not just conversion."
          description="The reference leaned on bold contrast, oversized typography, and interface-forward storytelling. This homepage follows that direction while staying grounded in your product model."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {valuePillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <Card
                key={pillar.title}
                className="rounded-[28px] border-white/10 bg-white/[0.03]"
              >
                <CardContent className="space-y-6 p-5 sm:p-6">
                  <div className="inline-flex rounded-2xl border border-white/10 bg-black/35 p-3">
                    <Icon className="size-5 text-cyan-200" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-display text-xl tracking-[-0.04em] text-white sm:text-2xl">
                      {pillar.title}
                    </h3>
                    <p className="text-sm leading-6 text-white/55">
                      {pillar.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Operational depth"
            title="The marketplace still needs real rails underneath."
            description="This is not a brochure site. The homepage now calls out the wallet, execution, and provider mechanics that already exist in the application."
          />
          <div className="space-y-3 text-sm text-white/55">
            {marketplaceCategories.map((category) => (
              <div
                key={category}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <span>{category}</span>
                <Layers3 className="size-4 text-white/35" />
              </div>
            ))}
          </div>
        </div>

        <Card className="rounded-[32px] border-white/10 bg-white/[0.03]">
          <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-4 rounded-[28px] border border-white/8 bg-black/40 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                Workflow loop
              </div>
              {launchSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-xs text-cyan-100">
                      0{index + 1}
                    </div>
                    <div className="font-medium text-white">{step.title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/50">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                    Commerce metrics
                  </div>
                  <div className="mt-2 font-display text-2xl tracking-[-0.04em] text-white">
                    What the product already supports
                  </div>
                </div>
                <BrainCircuit className="size-5 text-cyan-200" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: "Wallet balance",
                    value: "$42k",
                  },
                  {
                    label: "Purchases tracked",
                    value: "9.4k",
                  },
                  {
                    label: "Execution history",
                    value: "18.2k",
                  },
                  {
                    label: "Provider SKUs",
                    value: "240+",
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/8 bg-black/30 p-4"
                  >
                    <div className="text-xs uppercase tracking-[0.22em] text-white/35">
                      {metric.label}
                    </div>
                    <div className="mt-3 font-display text-3xl tracking-[-0.05em] text-white">
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 p-4 text-sm leading-7 text-cyan-50/85">
                Buyers get a cleaner marketplace story. Providers get a clearer
                reason to publish. The product gets a homepage that finally
                matches the sophistication of the flows behind it.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-14 sm:px-8 sm:pt-16">
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-6 py-8 sm:px-10 sm:py-12">
          <div className="max-w-3xl space-y-5">
            <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-white/70 hover:bg-white/5">
              Design bold. Launch fast.
            </Badge>
            <h2 className="font-display text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl lg:text-5xl">
              A homepage that looks like an actual product company built it.
            </h2>
            <p className="max-w-2xl text-[15px] leading-7 text-white/60 sm:text-base sm:leading-8">
              The new layout gives `packages/web` a proper front door: dark,
              modern, interface-led, and aligned with your marketplace,
              provider, wallet, and execution model.
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full bg-white px-5 text-sm text-black hover:bg-white/90"
              >
                <Link href="/login">
                  Enter marketplace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 rounded-full border-white/15 bg-transparent px-5 text-sm text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="#marketplace">Review the product story</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-white/40 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="font-display text-xl text-white">markgit</div>
          <div className="mt-2 max-w-md leading-7">
            Discover, buy, and run agents with markgit&apos;s marketplace clarity
            and provider-grade commercial rails.
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/login" className="transition hover:text-white">
            Sign in
          </Link>
          <Link href="#details" className="transition hover:text-white">
            Details
          </Link>
          <Link href="#providers" className="transition hover:text-white">
            Providers
          </Link>
        </div>
      </footer>
    </main>
  );
}
