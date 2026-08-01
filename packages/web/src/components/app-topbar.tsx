"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Wallet } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { label: "Tools", href: "/marketplace", matches: ["/marketplace", "/tools"] },
  { label: "Harnesses", href: "/harnesses", matches: ["/harnesses"] },
  { label: "MCPs", href: "/mcps", matches: ["/mcps"] },
  { label: "Skills", href: "/skills", matches: ["/skills"] },
  { label: "Leaderboard", href: "/leaderboard", matches: ["/leaderboard"] },
  { label: "Quicklist", href: "/dashboard", matches: ["/dashboard"] },
  { label: "Provider", href: "/provider", matches: ["/provider"] },
  { label: "Docs", href: "/docs", matches: ["/docs"] },
] as const;

export function AppTopbar({ user }: { user: { name?: string | null; email: string; image?: string | null } }) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = user.name
    ? user.name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-5 sm:px-8">
        <Link href="/dashboard" className="font-display text-lg font-semibold tracking-[-0.05em]">markgit</Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = item.matches.some((prefix) => pathname.startsWith(prefix));
            return <Link key={item.href} href={item.href} className={`rounded-lg px-3 py-1.5 text-[13px] transition ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</Link>;
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/wallet"><Wallet /> Wallet</Link></Button>
          <ThemeToggle className="size-8" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="size-8 rounded-full p-0"><Avatar className="size-8"><AvatarFallback className="bg-foreground text-xs text-background">{initials}</AvatarFallback></Avatar></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel><p className="text-sm font-medium">{user.name ?? "markgit user"}</p><p className="mt-1 truncate text-xs font-normal text-muted-foreground">{user.email}</p></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/history">History</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/wallet">Wallet</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 size-4" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden">
        {nav.map((item) => <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-md px-3 py-1 text-xs text-muted-foreground">{item.label}</Link>)}
      </nav>
    </header>
  );
}
