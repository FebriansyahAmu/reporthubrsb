"use client";

/** Tombol saran satu-klik di bawah kolom (mis. "Pasien sendiri: …"). */
export function Saran({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full border border-brand/30 bg-brand-soft/60 px-2.5 py-0.5 text-left text-xs font-medium text-brand-soft-fg transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
    >
      <span className="truncate">{children}</span>
    </button>
  );
}
