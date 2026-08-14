"use client";

import { cn } from "@/lib/cn";

/** Toggle aksesibel (role=switch) ter-style. */
export function Switch({
  checked,
  onChange,
  disabled,
  id,
  label,
  tone = "brand",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  tone?: "brand" | "success" | "danger";
}) {
  const onColor =
    tone === "success" ? "bg-success" : tone === "danger" ? "bg-danger" : "bg-brand";
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-50 disabled:pointer-events-none",
        checked ? onColor : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "inline-block size-4.5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}
