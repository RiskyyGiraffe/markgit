import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { auth } from "@/lib/auth";

export async function PublicHeader() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) return <AppTopbar user={session.user} />;

  return (
    <header className="border-b bg-background text-foreground">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="font-display text-lg font-semibold tracking-[-0.05em]">
          markgit
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] text-muted-foreground sm:flex">
          <Link href="/tools" className="transition hover:text-foreground">Marketplace</Link>
          <Link href="/leaderboard" className="transition hover:text-foreground">Leaderboard</Link>
          <Link href="/docs" className="transition hover:text-foreground">Docs</Link>
          <a href="/llms.txt" className="transition hover:text-foreground">llms.txt</a>
        </nav>
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center gap-2 rounded-lg border bg-foreground px-3 text-xs font-medium text-background transition hover:opacity-85"
        >
          Dashboard
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </header>
  );
}
