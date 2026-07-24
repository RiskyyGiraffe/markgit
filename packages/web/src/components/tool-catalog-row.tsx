import Link from "next/link";
import type { ToolCard } from "@markgit/sdk";
import {
  Braces,
  Database,
  Image,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

function toolIcon(category: string | null) {
  const value = category?.toLowerCase() ?? "";
  if (value.includes("search") || value.includes("research")) return Search;
  if (value.includes("data") || value.includes("database")) return Database;
  if (value.includes("image") || value.includes("media")) return Image;
  if (value.includes("email") || value.includes("communication")) return Mail;
  if (value.includes("security") || value.includes("risk")) return ShieldCheck;
  if (value.includes("developer") || value.includes("code")) return Braces;
  if (value.includes("ai") || value.includes("generation")) return Sparkles;
  return Wrench;
}

export function ToolCatalogRow({ tool }: { tool: ToolCard }) {
  const Icon = toolIcon(tool.category);
  const price = tool.pricing.type === "free" ? "Free" : `$${tool.pricing.amount}`;

  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group grid min-h-[92px] grid-cols-[48px_1fr_auto] items-center gap-4 border-t border-black/8 py-5 transition hover:bg-black/[0.018] sm:px-2"
    >
      <span className="flex size-12 items-center justify-center rounded-[14px] border border-black/10 bg-white shadow-sm">
        <Icon className="size-5 text-black/70" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-[#171714]">{tool.name}</span>
          {tool.provider.trustTier === "verified" || tool.provider.trustTier === "premium" ? (
            <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" aria-label="Verified provider" />
          ) : null}
        </span>
        <span className="mt-1 block truncate text-sm text-black/48">
          {tool.description ?? `A tool by ${tool.provider.name}`}
        </span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-black/42">
          <span>{tool.usage.usersLabel}</span>
          <span>{tool.usage.invocationsLabel}</span>
        </span>
      </span>
      <span className="flex flex-col items-end gap-2 pl-2">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black/65">
          {price}
        </span>
        <span className="text-[11px] text-black/35 group-hover:text-black/60">View docs</span>
      </span>
    </Link>
  );
}
