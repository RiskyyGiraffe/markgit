"use client";

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

const installCommand = "npm install -g @markgit/cli && markgit login";

export function InstallCommandCard() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-3 shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between px-2 pb-3 pt-1 text-xs text-white/45">
        <span className="inline-flex items-center gap-2">
          <Terminal className="size-3.5" />
          Install and link the CLI
        </span>
        <span>npm</span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/35 px-4 py-4">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-white/85">
          {installCommand}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy install command"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="px-2 pb-1 pt-3 text-xs leading-5 text-white/40">
        Then publish with <code className="text-white/65">markgit onboard markgit-tool.json</code>
      </p>
    </div>
  );
}
