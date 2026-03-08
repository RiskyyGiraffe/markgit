"use client";

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

const installCommand =
  "git clone https://github.com/RiskyyGiraffe/agentmarket.git markgit && cd markgit && pnpm install && pnpm dev:all";

export function InstallCommandCard() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-white/75">
            <Terminal className="size-4 text-cyan-200" />
            Install markgit locally
          </div>
          <p className="max-w-2xl text-sm leading-6 text-white/50">
            One command to clone the repo, install dependencies, and boot the
            markgit workspace. Requires Node 20+ and `pnpm`.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleCopy}
          variant="outline"
          className="rounded-full border-white/15 bg-white/[0.03] text-white hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy command"}
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[22px] border border-white/8 bg-black/40 px-4 py-4">
        <code className="font-mono text-[13px] leading-6 text-cyan-50/90">
          {installCommand}
        </code>
      </div>
    </div>
  );
}
