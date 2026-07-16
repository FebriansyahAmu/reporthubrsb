const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  return dateTimeFmt.format(new Date(iso));
}

export function formatTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  return timeFmt.format(new Date(iso));
}

/** Hitung umur (tahun) dari tanggal lahir. */
export function umur(tanggalLahir: string): string {
  const lahir = new Date(tanggalLahir);
  const now = new Date("2026-07-16");
  let th = now.getFullYear() - lahir.getFullYear();
  const m = now.getMonth() - lahir.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < lahir.getDate())) th--;
  return `${th} th`;
}

/** yyyy-mm-dd untuk value input[type=date]. */
export function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}
