import Link from "next/link";
import { Boxes, Bot, Waypoints } from "lucide-react";

const tabs = [
  { id: "tools", label: "Tools", href: "/tools", icon: Boxes },
  { id: "harnesses", label: "Harnesses", href: "/harnesses", icon: Waypoints },
  { id: "mcps", label: "MCPs", href: "/mcps", icon: Bot },
] as const;

export function CatalogTabs({ active }: { active: (typeof tabs)[number]["id"] }) {
  return (
    <nav aria-label="Marketplace type" className="flex items-center gap-1 border-b">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={`relative inline-flex h-11 items-center gap-2 px-3 text-sm transition ${selected ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-3.5" />
            {tab.label}
            {selected ? <span className="absolute inset-x-2 bottom-[-1px] h-0.5 rounded-full bg-foreground" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
