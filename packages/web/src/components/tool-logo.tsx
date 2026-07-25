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

  useEffect(() => setImageFailed(false), [logoUrl]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-white/[0.09] bg-[#202326] text-[#d9dcde] shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
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
