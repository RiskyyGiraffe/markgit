"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthorizationMode } from "@markgit/sdk";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeQuicklistTool, saveQuicklistTool } from "@/actions/quicklist";
import { Button } from "@/components/ui/button";

const options: Array<{ value: AuthorizationMode; label: string }> = [
  { value: "ask_paid", label: "Ask for charged calls" },
  { value: "ask_every", label: "Ask every call" },
  { value: "never_ask", label: "Don't ask" },
];

export function QuicklistControl({
  slug,
  initialMode,
  versionCurrent = true,
}: {
  slug: string;
  initialMode?: AuthorizationMode;
  versionCurrent?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthorizationMode>(initialMode ?? "ask_paid");
  const [installed, setInstalled] = useState(Boolean(initialMode));
  const [loading, setLoading] = useState(false);

  const save = async (nextMode = mode) => {
    setLoading(true);
    try {
      await saveQuicklistTool(slug, nextMode);
      setInstalled(true);
      setMode(nextMode);
      toast.success("Agent quicklist synced");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync quicklist");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      await removeQuicklistTool(slug);
      setInstalled(false);
      toast.success("Removed from agent quicklist");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update quicklist");
    } finally {
      setLoading(false);
    }
  };

  if (!installed) {
    return <Button size="sm" variant="outline" disabled={loading} onClick={() => save()}>{loading ? <Loader2 className="animate-spin" /> : <Plus />}Quicklist</Button>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:inline-flex"><Check className="size-3.5" /> Synced</span>
      <select
        aria-label={`Authorization for ${slug}`}
        value={mode}
        disabled={loading}
        className={`h-8 max-w-44 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring ${versionCurrent ? "" : "border-amber-500 text-amber-700"}`}
        onChange={(event) => save(event.target.value as AuthorizationMode)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Button type="button" size="icon" variant="ghost" className="size-8" disabled={loading} onClick={remove} aria-label={`Remove ${slug} from quicklist`}>
        {loading ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  );
}
