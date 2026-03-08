"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Wallet,
  History,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Marketplace", href: "/marketplace", icon: Store },
  { title: "Wallet", href: "/wallet", icon: Wallet },
  { title: "Provider", href: "/provider", icon: Building2 },
  { title: "History", href: "/history", icon: History },
];

export function AppSidebar({ user }: { user: { name?: string | null; email: string } }) {
  const pathname = usePathname();

  return (
    <Sidebar variant="floating" collapsible="icon" className="p-3">
      <SidebarHeader className="gap-3 rounded-[28px] border border-black/5 bg-white/90 p-4 shadow-sm backdrop-blur">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-black text-sm font-semibold text-white shadow-sm">
            M
          </div>
          <div className="grid gap-0.5 group-data-[collapsible=icon]:hidden">
            <span className="font-display text-lg font-medium tracking-[-0.04em] text-black">
              markgit
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/45">
              Agent commerce
            </span>
          </div>
        </Link>
        <div className="rounded-2xl border border-black/5 bg-[#f5f5f1] px-3 py-3 group-data-[collapsible=icon]:hidden">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-black/45">
            Workspace
          </div>
          <div className="mt-1 text-sm text-black/70">
            Monitor wallet, runs, and provider performance across markgit.
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="mt-4 gap-4">
        <SidebarGroup className="p-1">
          <SidebarGroupLabel className="px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-black/40">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.title}
                    className={cn(
                      "h-11 rounded-2xl px-3.5 text-[15px] shadow-none transition-all",
                      pathname.startsWith(item.href)
                        ? "bg-black text-white hover:bg-black hover:text-white"
                        : "text-black/62 hover:bg-black/[0.035] hover:text-black"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto rounded-[28px] border border-black/5 bg-white/90 p-4 shadow-sm backdrop-blur group-data-[collapsible=icon]:hidden">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/40">
          Signed in
        </div>
        <div className="text-sm font-medium text-black">
          {user.name ?? "markgit user"}
        </div>
        <div className="text-sm text-black/55">{user.email}</div>
      </SidebarFooter>
    </Sidebar>
  );
}
