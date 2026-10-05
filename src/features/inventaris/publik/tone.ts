import type { TonePublik } from "@/server/modules/inventaris/publik.types";

/** Warna kondisi (titik legenda / baris). Selalu berdampingan dengan label — tak mengandalkan warna saja. */
export const TITIK_KONDISI: Record<TonePublik, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-fg-subtle",
};

/** Isi segmen SVG bilah komposisi (atribut, bukan `style` — patuh CSP halaman publik). */
export const ISI_KONDISI: Record<TonePublik, string> = {
  success: "fill-success",
  warning: "fill-warning",
  danger: "fill-danger",
  neutral: "fill-fg-subtle",
};
