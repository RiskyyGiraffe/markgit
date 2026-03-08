"use client";

import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Search, Sparkles } from "lucide-react";

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Command center" },
  "/marketplace": { title: "Marketplace", subtitle: "Discover and execute" },
  "/wallet": { title: "Wallet", subtitle: "Funds and ledger" },
  "/provider": { title: "Provider", subtitle: "Catalog and payouts" },
  "/history": { title: "History", subtitle: "Purchases and runs" },
};

export function AppTopbar({
  user,
}: {
  user: { name?: string | null; email: string; image?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  const meta =
    Object.entries(routeMeta).find(([route]) => pathname.startsWith(route))?.[1] ??
    routeMeta["/dashboard"];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-[#f7f7f3]/85 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1 rounded-xl border border-black/5 bg-white text-black shadow-sm hover:bg-white" />
        <div className="hidden min-w-0 sm:block">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/40">
            {meta.subtitle}
          </div>
          <div className="truncate text-sm font-medium text-black">
            {meta.title}
          </div>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center lg:flex">
        <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm text-black/45 shadow-sm">
          <Search className="size-4" />
          <span>Search products, runs, or providers</span>
          <span className="ml-auto rounded-md border border-black/5 px-2 py-0.5 font-mono text-[11px] text-black/40">
            /
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-2 text-sm text-black/60 shadow-sm md:flex">
          <Sparkles className="size-4 text-emerald-600" />
          <span>Live workspace</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full border border-black/5 bg-white shadow-sm hover:bg-white"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-black text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-2xl border-black/10 p-2"
            align="end"
          >
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                {user.name && (
                  <p className="text-sm font-medium">{user.name}</p>
                )}
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
