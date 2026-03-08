"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "rounded-full border border-border/70 bg-card text-foreground shadow-sm hover:bg-accent",
        className,
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun
        className={cn(
          "size-4 transition-all",
          isDark ? "scale-100 rotate-0" : "scale-0 -rotate-90",
        )}
      />
      <Moon
        className={cn(
          "absolute size-4 transition-all",
          isDark ? "scale-0 rotate-90" : "scale-100 rotate-0",
        )}
      />
      <span className="sr-only">
        {isDark ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </Button>
  );
}
