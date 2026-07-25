import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="border-b border-white/[0.075] bg-[#101213] text-[#f1f2f2]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="font-display text-lg font-semibold tracking-[-0.05em]">
          markgit
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] text-[#868c90] sm:flex">
          <Link href="/tools" className="transition hover:text-[#f1f2f2]">Tools</Link>
          <Link href="/docs" className="transition hover:text-[#f1f2f2]">Docs</Link>
          <a href="/llms.txt" className="transition hover:text-[#f1f2f2]">llms.txt</a>
        </nav>
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.055] px-3 text-xs font-medium text-[#eceeee] transition hover:bg-white/[0.09]"
        >
          Dashboard
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </header>
  );
}
