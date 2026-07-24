import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="border-b border-black/10 bg-[#f8f8f5] text-[#171714]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="font-display text-xl font-semibold tracking-[-0.05em]">
          markgit
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-black/60 sm:flex">
          <Link href="/tools" className="transition hover:text-black">Tools</Link>
          <Link href="/docs" className="transition hover:text-black">Docs</Link>
          <a href="/llms.txt" className="transition hover:text-black">llms.txt</a>
        </nav>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center gap-2 rounded-full bg-[#171714] px-4 text-sm font-medium text-white transition hover:bg-black/80"
        >
          Dashboard
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </header>
  );
}
