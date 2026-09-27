"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Paginasi bernomor (1 … 4 5 6 … 13) — untuk daftar yang tidak boleh berupa
 * scroll tak berujung. Selalu menampilkan halaman pertama, terakhir, dan
 * `siblings` halaman di kiri-kanan halaman aktif.
 */
export function NumberedPagination({
  page,
  totalPages,
  onPageChange,
  siblings = 1,
  disabled,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblings?: number;
  disabled?: boolean;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const items = pageItems(page, totalPages, siblings);

  return (
    <nav aria-label="Navigasi halaman" className={cn("flex items-center gap-1", className)}>
      <PageBtn disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Halaman sebelumnya">
        <ChevronLeft className="size-4" />
      </PageBtn>
      {items.map((it, i) =>
        it === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-fg-subtle" aria-hidden>
            …
          </span>
        ) : (
          <PageBtn
            key={it}
            disabled={disabled}
            onClick={() => onPageChange(it)}
            aria-label={`Halaman ${it}`}
            aria-current={it === page ? "page" : undefined}
            className={cn(
              "min-w-8 px-2 text-xs font-medium tabular",
              it === page && "border-brand bg-brand text-white hover:bg-brand hover:text-white",
            )}
          >
            {it}
          </PageBtn>
        ),
      )}
      <PageBtn disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Halaman berikutnya">
        <ChevronRight className="size-4" />
      </PageBtn>
    </nav>
  );
}

function pageItems(page: number, total: number, siblings: number): (number | "gap")[] {
  const set = new Set<number>([1, total]);
  for (let p = page - siblings; p <= page + siblings; p++) if (p >= 1 && p <= total) set.add(p);
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const diff = sorted[i] - sorted[i - 1];
      if (diff === 2) out.push(sorted[i] - 1);
      else if (diff > 2) out.push("gap");
    }
    out.push(sorted[i]);
  }
  return out;
}

function PageBtn({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-md)] border border-border text-fg-muted transition-colors",
        "hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
