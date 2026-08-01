"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  Braces,
  CalendarDays,
  CloudSun,
  Database,
  FileText,
  Globe2,
  Image,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolLogoProps = {
  name: string;
  logoUrl?: string | null;
  category?: string | null;
  tags?: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
};

function fallbackIcon(name: string, category?: string | null, tags: string[] = []) {
  const value = [name, category, ...tags].filter(Boolean).join(" ").toLowerCase();
  if (/(exchange|currency|finance|bank|money|payment)/.test(value)) return ArrowLeftRight;
  if (/(holiday|calendar|schedule|date|time)/.test(value)) return CalendarDays;
  if (/(earthquake|seismic|monitor|status|analytics)/.test(value)) return Activity;
  if (/(weather|climate|forecast)/.test(value)) return CloudSun;
  if (/(search|research|lookup|discover)/.test(value)) return Search;
  if (/(data|database|storage|sql)/.test(value)) return Database;
  if (/(image|photo|media|video)/.test(value)) return Image;
  if (/(email|mail|message|communication)/.test(value)) return Mail;
  if (/(security|identity|risk|verify)/.test(value)) return ShieldCheck;
  if (/(developer|code|api|programming)/.test(value)) return Braces;
  if (/(text|document|pdf|write|content)/.test(value)) return FileText;
  if (/(location|map|travel|country|global)/.test(value)) return Globe2;
  if (/(ai|agent|generation|creative)/.test(value)) return Sparkles;
  return Wrench;
}

function fallbackTone(name: string, category?: string | null, tags: string[] = []) {
  const value = [name, category, ...tags].filter(Boolean).join(" ").toLowerCase();
  if (/(exchange|currency|finance|bank|money|payment)/.test(value)) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (/(holiday|calendar|schedule|date|time)/.test(value)) return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (/(weather|climate|forecast|location|map|travel|country|global)/.test(value)) return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (/(search|research|lookup|discover|data|database|storage|sql)/.test(value)) return "bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (/(image|photo|media|video|ai|agent|generation|creative)/.test(value)) return "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300";
  if (/(email|mail|message|communication|text|document|pdf|write|content)/.test(value)) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (/(security|identity|risk|verify)/.test(value)) return "bg-teal-500/10 text-teal-700 dark:text-teal-300";
  if (/(developer|code|api|programming|mcp)/.test(value)) return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
  return "bg-muted text-muted-foreground";
}

const dimensions = {
  sm: "size-9 rounded-[10px]",
  md: "size-11 rounded-xl",
  lg: "size-16 rounded-2xl",
};

const iconDimensions = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

export function ToolLogo({
  name,
  logoUrl,
  category,
  tags = [],
  size = "md",
  className,
}: ToolLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = fallbackIcon(name, category, tags);
  const tone = fallbackTone(name, category, tags);

  useEffect(() => setImageFailed(false), [logoUrl]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-background shadow-sm",
        !logoUrl || imageFailed ? tone : null,
        dimensions[size],
        className,
      )}
      aria-hidden="true"
    >
      {logoUrl && !imageFailed ? (
        // Remote logos are loaded by the visitor's browser; Markgit never fetches publisher assets server-side.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain p-1.5"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon className={iconDimensions[size]} strokeWidth={1.75} />
      )}
    </span>
  );
}
