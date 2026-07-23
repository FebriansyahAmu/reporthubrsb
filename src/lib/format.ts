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

/** Format durasi dari menit → "5 mnt" / "1 j 20 mnt". */
export function formatDurasi(menit: number | null | undefined): string {
  if (menit == null || menit < 0) return "—";
  if (menit < 60) return `${menit} mnt`;
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return m === 0 ? `${j} j` : `${j} j ${m} mnt`;
}

/** Jam:menit:detik untuk indikator "diperbarui pukul ...". */
export function formatJam(iso: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

/** Parse tanggal format Indonesia "dd-mm-yyyy" atau "dd-mm-yyyy HH:mm:ss" → Date | null. */
export function parseIdDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [datePart, timePart] = s.trim().split(" ");
  const [dd, mm, yyyy] = datePart.split(/[-/]/).map(Number);
  if (!dd || !mm || !yyyy) return null;
  const [h = 0, mi = 0, se = 0] = (timePart?.split(":") ?? []).map(Number);
  const d = new Date(yyyy, mm - 1, dd, h, mi, se);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hitung umur "X th Y bl" dari Date lahir terhadap acuan (default hari ini). */
export function hitungUmur(lahir: Date | null, acuan = new Date("2026-07-23")): string | null {
  if (!lahir) return null;
  let th = acuan.getFullYear() - lahir.getFullYear();
  let bl = acuan.getMonth() - lahir.getMonth();
  if (acuan.getDate() < lahir.getDate()) bl--;
  if (bl < 0) {
    th--;
    bl += 12;
  }
  return `${th} th ${bl} bl`;
}

/** ISO → "HH:MM" untuk value input[type=time]. */
export function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Gabungkan tanggal (YYYY-MM-DD) + "HH:MM" → ISO. */
export function timeInputToIso(tanggal: string, hhmm: string): string {
  return new Date(`${tanggal}T${hhmm}:00`).toISOString();
}
