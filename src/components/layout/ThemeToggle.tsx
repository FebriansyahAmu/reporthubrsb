"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

const KEY = "theme";

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Terang" },
  { value: "system", icon: Monitor, label: "Sistem" },
  { value: "dark", icon: Moon, label: "Gelap" },
];

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

// Sumber kebenaran tema = localStorage (external store), dibaca via useSyncExternalStore.
function subscribe(cb: () => void) {
  window.addEventListener("theme-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("theme-change", cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): Theme {
  return (localStorage.getItem(KEY) as Theme) || "system";
}
function getServerSnapshot(): Theme {
  return "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Terapkan ke DOM saat tema berubah (efek sinkron ke sistem eksternal — bukan setState).
  useEffect(() => {
    apply(theme);
  }, [theme]);

  function choose(t: Theme) {
    localStorage.setItem(KEY, t);
    window.dispatchEvent(new Event("theme-change"));
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className="inline-flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            theme === value
              ? "bg-brand-soft text-brand-soft-fg"
              : "text-fg-subtle hover:text-fg",
          )}
        >
          <Icon className="size-4" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
