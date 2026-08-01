import Link from "next/link";
import type { ToolCard } from "@markgit/sdk";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { ToolLogo } from "@/components/tool-logo";

export function ToolCatalogRow({ tool }: { tool: ToolCard }) {
  const price = tool.pricing.type === "free" ? "Free" : `$${tool.pricing.amount}`;

  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group grid min-h-[76px] grid-cols-[44px_1fr_auto] items-center gap-3 border-t border-white/[0.075] py-3.5 transition hover:bg-white/[0.025] sm:px-2"
    >
      <ToolLogo
        name={tool.name}
        logoUrl={tool.logoUrl}
        category={tool.category}
        tags={tool.tags}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-[#f2f3f3]">{tool.name}</span>
          {tool.provider.trustTier === "verified" || tool.provider.trustTier === "premium" ? (
            <ShieldCheck className="size-3.5 shrink-0 text-[#8ca2ad]" aria-label="Verified provider" />
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-[#8f9498]">
          {tool.description ?? `A tool by ${tool.provider.name}`}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-[#6f7478]">
          <span>{tool.trust.endpoint.status} endpoint</span>
          <span>{tool.risk.level} risk</span>
          <span>{tool.usage.usersLabel}</span>
          <span>{tool.usage.invocationsLabel}</span>
        </span>
      </span>
      <span className="flex items-center gap-2 pl-2">
        <span className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-2.5 py-1 text-[11px] font-medium text-[#c4c7c9]">
          {price}
        </span>
        <ArrowUpRight className="size-3.5 text-[#555b5f] transition group-hover:text-[#c4c7c9]" />
      </span>
    </Link>
  );
}
