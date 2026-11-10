"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, KeyRound, Loader2, MonitorSmartphone, PenLine, Unplug, Wifi } from "lucide-react";
import { cn } from "@/lib/cn";
import { KanvasPermintaan } from "./KanvasPermintaan";
import { ALFABET_KODE, PANJANG_KODE } from "./kode-pasang";
import { BATAS_SENYAP_MS } from "./sse";
import type { PermintaanTabletDto } from "./types";

/**
 * Layar tablet TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.1–5.2).
 * Halaman ini berjalan di bawah CSP ketat ber-nonce: TANPA atribut `style`
 * inline dan tanpa pustaka animasi — hanya kelas CSS. Tidak pernah menampilkan
 * maupun menyimpan data pasien (K2); tidak memakai localStorage. Permintaan TTD
 * (§5.4) hanya membawa ID + putaran dan membuka `KanvasPermintaan`.
 */

type Fase =
  | { jenis: "pasang"; pesan: string | null }
  | { jenis: "siaga"; nama: string }
  | { jenis: "diganti"; nama: string };

type Koneksi = "menyambung" | "siap" | "terputus";

const API = "/api/ttd-siaga";
const SEGARKAN_SETIAP_MS = 6 * 60 * 60_000;
const JEDA_AWAL_MS = 3_000;
const JEDA_MAKS_MS = 30_000;

const PESAN_TAK_BERLAKU = "Pemasangan tablet ini sudah tidak berlaku. Minta kode pasang baru ke pengelola.";
const PESAN_DICABUT = "Tablet ini dicabut oleh pengelola. Minta kode pasang baru untuk memakainya lagi.";

const WITA = "Asia/Makassar";
const fmtJam = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, hour: "2-digit", minute: "2-digit" });
const fmtTanggal = new Intl.DateTimeFormat("id-ID", { timeZone: WITA, weekday: "long", day: "numeric", month: "long" });

export function LayarTtdSiaga({ awal }: { awal: { nama: string } | null }) {
  const [fase, setFase] = useState<Fase>(awal ? { jenis: "siaga", nama: awal.nama } : { jenis: "pasang", pesan: null });
  const [sesi, setSesi] = useState(0);

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-bg text-fg">
      {fase.jenis === "pasang" && (
        <LayarPasang
          pesan={fase.pesan}
          onTerpasang={(nama) => {
            setSesi((s) => s + 1);
            setFase({ jenis: "siaga", nama });
          }}
        />
      )}
      {fase.jenis === "siaga" && (
        <LayarSiaga
          key={sesi}
          nama={fase.nama}
          onNama={(nama) => setFase((f) => (f.jenis === "siaga" && f.nama !== nama ? { ...f, nama } : f))}
          onTakTerpasang={(pesan) => setFase({ jenis: "pasang", pesan })}
          onDiganti={() => setFase((f) => ({ jenis: "diganti", nama: f.jenis === "pasang" ? "" : f.nama }))}
        />
      )}
      {fase.jenis === "diganti" && (
        <LayarDiganti
          onPakai={() => {
            setSesi((s) => s + 1);
            setFase({ jenis: "siaga", nama: fase.nama });
          }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ logo */

function Merek() {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo statis, halaman ber-CSP ketat */}
      <img src="/logo/logoboltim.png" alt="" className="size-9 object-contain" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-fg">RSUD Boltim</p>
        <p className="text-xs text-fg-muted">Tanda tangan siaga</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pasang */

const BUKAN_ALFABET = new RegExp(`[^${ALFABET_KODE}]`, "g");
const rapikanKode = (v: string) => {
  const k = v.toUpperCase().replace(BUKAN_ALFABET, "").slice(0, PANJANG_KODE);
  return k.length > 4 ? `${k.slice(0, 4)}-${k.slice(4)}` : k;
};

type HasilPasang = { ok: true; nama: string } | { ok: false; pesan: string };

async function kirimPasang(kode: string): Promise<HasilPasang> {
  let r: Response;
  try {
    r = await fetch(`${API}/pasang`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ kode }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, pesan: "Tidak bisa terhubung ke server. Periksa Wi-Fi tablet, lalu coba lagi." };
  }
  if (r.ok) {
    const body = (await r.json().catch(() => null)) as { data?: { nama?: string } } | null;
    return { ok: true, nama: body?.data?.nama ?? "" };
  }
  if (r.status === 401) return { ok: false, pesan: "Kode salah atau sudah kedaluwarsa. Minta kode baru ke pengelola." };
  if (r.status === 429) {
    const detik = Number(r.headers.get("retry-after")) || 60;
    return { ok: false, pesan: `Terlalu banyak percobaan. Coba lagi dalam ${detik} detik.` };
  }
  return { ok: false, pesan: "Pemasangan gagal. Coba lagi sebentar lagi." };
}

function LayarPasang({ pesan, onTerpasang }: { pesan: string | null; onTerpasang: (nama: string) => void }) {
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [memproses, setMemproses] = useState(false);
  const selesai = useRef(onTerpasang);
  useEffect(() => {
    selesai.current = onTerpasang;
  });

  // QR pemasangan membawa kode di FRAGMEN (`#kode=…`) — tak terkirim ke server/log.
  // Fragmen langsung dihapus dari URL, lalu kode ditukar otomatis. `hashchange`:
  // QR dipindai saat layar pasang sudah terbuka (navigasi hanya mengganti fragmen).
  useEffect(() => {
    let batal = false;
    const cobaFragmen = () => {
      const m = /^#kode=([A-Za-z0-9-]{8,9})$/.exec(window.location.hash);
      if (!m) return;
      window.history.replaceState(null, "", window.location.pathname);
      void kirimPasang(m[1]).then((h) => {
        if (batal) return;
        if (h.ok) selesai.current(h.nama);
        else setGalat(h.pesan);
      });
    };
    cobaFragmen();
    window.addEventListener("hashchange", cobaFragmen);
    return () => {
      batal = true;
      window.removeEventListener("hashchange", cobaFragmen);
    };
  }, []);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (kode.replace("-", "").length !== PANJANG_KODE) {
      setGalat(`Kode pasang terdiri dari ${PANJANG_KODE} karakter.`);
      return;
    }
    setMemproses(true);
    setGalat(null);
    const h = await kirimPasang(kode);
    setMemproses(false);
    if (h.ok) onTerpasang(h.nama);
    else setGalat(h.pesan);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-10">
      <Merek />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg ring-1 ring-inset ring-brand/15">
          <KeyRound className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Pasangkan tablet ini</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Masukkan kode pasang dari pengelola. Kode dibuat di Form RM › Perangkat TTD dan berlaku 10 menit.
        </p>
        {pesan && (
          <p className="mt-5 flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning" role="status">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{pesan}</span>
          </p>
        )}
        <form onSubmit={(e) => void kirim(e)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="kode-pasang" className="mb-1.5 block text-xs font-medium text-fg-muted">
              Kode pasang
            </label>
            <input
              id="kode-pasang"
              value={kode}
              onChange={(e) => setKode(rapikanKode(e.target.value))}
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={PANJANG_KODE + 1}
              placeholder="XXXX-XXXX"
              aria-invalid={!!galat}
              aria-describedby={galat ? "kode-pasang-galat" : undefined}
              className="h-16 w-full rounded-xl border border-border bg-surface px-4 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-fg shadow-xs placeholder:text-fg-subtle/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40 aria-[invalid=true]:border-danger"
            />
            {galat && (
              <p id="kode-pasang-galat" className="mt-2 text-sm text-danger" role="alert">
                {galat}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={memproses}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-brand-fg shadow-xs transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {memproses && <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden />}
            {memproses ? "Memasangkan…" : "Pasangkan"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- siaga */

/** Jam dinding WITA, berdetak tiap 15 dtk (null sampai detak pertama — aman hydration). */
function useJam(): { jam: string; tanggal: string } | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const awal = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => {
      clearTimeout(awal);
      clearInterval(id);
    };
  }, []);
  if (now === null) return null;
  const d = new Date(now);
  return { jam: fmtJam.format(d), tanggal: fmtTanggal.format(d) };
}

/** Tahan layar tetap menyala selama halaman terlihat (bila peramban mendukung & konteks aman). */
function useLayarMenyala() {
  useEffect(() => {
    let kunci: WakeLockSentinel | null = null;
    let mati = false;
    const minta = async () => {
      if (mati || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        kunci = await navigator.wakeLock.request("screen");
      } catch {
        /* tak didukung / ditolak (mis. HTTP tanpa konteks aman) — andalkan pengaturan kiosk */
      }
    };
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") void minta();
    };
    void minta();
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      mati = true;
      document.removeEventListener("visibilitychange", saatTerlihat);
      void kunci?.release().catch(() => {});
    };
  }, []);
}

/** Data JSON event SSE (null bila rusak). */
function baca(ev: Event): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse((ev as MessageEvent<string>).data);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const ID_PERMINTAAN_RE = /^[A-Za-z0-9_-]{22}$/;

function bacaPermintaan(v: unknown): PermintaanTabletDto | null {
  if (!v || typeof v !== "object") return null;
  const { id, putaran } = v as Record<string, unknown>;
  if (typeof id !== "string" || !ID_PERMINTAAN_RE.test(id)) return null;
  if (typeof putaran !== "number" || !Number.isInteger(putaran) || putaran < 1) return null;
  return { id, putaran };
}

const samaPermintaan = (a: PermintaanTabletDto | null, b: PermintaanTabletDto | null) =>
  a?.id === b?.id && a?.putaran === b?.putaran;

/**
 * Aliran SSE + penjagaannya: periksa pemasangan (`segarkan`, sekaligus rotasi),
 * buka EventSource, watchdog detak, sambung ulang bertahap 3 → 30 dtk (EventSource
 * berhenti sendiri setelah respons non-200, jadi selalu disambung manual),
 * sambung segera saat layar kembali terlihat / jaringan pulih.
 */
function useAliranSiaga(cb: {
  onNama: (nama: string) => void;
  onTakTerpasang: (pesan: string) => void;
  onDiganti: () => void;
  /** Permintaan yang menunggu kanvas (`siap` membawa null bila tak ada). */
  onPermintaan: (p: PermintaanTabletDto | null) => void;
  onSelesai: (id: string) => void;
}): Koneksi {
  const [koneksi, setKoneksi] = useState<Koneksi>("menyambung");
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let mati = false;
    let berjalan = false;
    let jeda = JEDA_AWAL_MS;
    let terakhir = Date.now();
    let timerUlang: ReturnType<typeof setTimeout> | undefined;

    const putus = () => {
      if (es) {
        es.close();
        es = null;
      }
    };
    const berhenti = (aksi: () => void) => {
      mati = true;
      putus();
      clearTimeout(timerUlang);
      aksi();
    };
    const jadwalUlang = () => {
      if (mati) return;
      putus();
      setKoneksi("terputus");
      clearTimeout(timerUlang);
      timerUlang = setTimeout(() => {
        setKoneksi("menyambung");
        void sambung();
      }, jeda);
      jeda = Math.min(jeda * 2, JEDA_MAKS_MS);
    };
    const sambung = async () => {
      if (mati || berjalan) return;
      berjalan = true;
      try {
        let r: Response;
        try {
          r = await fetch(`${API}/segarkan`, { method: "POST", headers: { Accept: "application/json" }, cache: "no-store" });
        } catch {
          jadwalUlang();
          return;
        }
        if (mati) return;
        if (r.status === 401) return berhenti(() => ref.current.onTakTerpasang(PESAN_TAK_BERLAKU));
        if (!r.ok) return jadwalUlang();
        const body = (await r.json().catch(() => null)) as { data?: { nama?: string } } | null;
        if (body?.data?.nama) ref.current.onNama(body.data.nama);
        if (mati) return;

        putus();
        const sumber = new EventSource(`${API}/aliran`);
        es = sumber;
        terakhir = Date.now();
        sumber.addEventListener("siap", (ev) => {
          terakhir = Date.now();
          jeda = JEDA_AWAL_MS;
          setKoneksi("siap");
          ref.current.onPermintaan(bacaPermintaan(baca(ev)?.permintaan));
        });
        sumber.addEventListener("detak", () => {
          terakhir = Date.now();
        });
        sumber.addEventListener("permintaan", (ev) => {
          terakhir = Date.now();
          const p = bacaPermintaan(baca(ev));
          if (p) ref.current.onPermintaan(p);
        });
        sumber.addEventListener("selesai", (ev) => {
          terakhir = Date.now();
          const id = baca(ev)?.id;
          if (typeof id === "string") ref.current.onSelesai(id);
        });
        sumber.addEventListener("dicabut", () => berhenti(() => ref.current.onTakTerpasang(PESAN_DICABUT)));
        sumber.addEventListener("diganti", () => berhenti(() => ref.current.onDiganti()));
        sumber.onerror = () => {
          if (es === sumber) jadwalUlang();
        };
      } finally {
        berjalan = false;
      }
    };

    const anjing = setInterval(() => {
      if (es && Date.now() - terakhir > BATAS_SENYAP_MS) jadwalUlang();
    }, 5_000);
    // Rotasi kredensial berkala walau aliran tak pernah putus berhari-hari.
    const segar = setInterval(() => {
      if (!es || mati) return;
      void fetch(`${API}/segarkan`, { method: "POST", cache: "no-store" })
        .then((r) => {
          if (r.status === 401) berhenti(() => ref.current.onTakTerpasang(PESAN_TAK_BERLAKU));
        })
        .catch(() => {});
    }, SEGARKAN_SETIAP_MS);
    const segera = () => {
      if (mati || es || document.visibilityState !== "visible") return;
      clearTimeout(timerUlang);
      jeda = JEDA_AWAL_MS;
      setKoneksi("menyambung");
      void sambung();
    };
    document.addEventListener("visibilitychange", segera);
    window.addEventListener("online", segera);
    void sambung();

    return () => {
      mati = true;
      putus();
      clearTimeout(timerUlang);
      clearInterval(anjing);
      clearInterval(segar);
      document.removeEventListener("visibilitychange", segera);
      window.removeEventListener("online", segera);
    };
  }, []);

  return koneksi;
}

const TAMPIL_KONEKSI: Record<Koneksi, { judul: string; isi: string; titik: string; cincin: string; label: string }> = {
  siap: {
    judul: "Siap menerima tanda tangan",
    isi: "Petugas mengirim permintaan dari komputer. Kanvas tanda tangan akan muncul di layar ini.",
    titik: "bg-success",
    cincin: "bg-success-soft text-success ring-success/20",
    label: "Terhubung",
  },
  menyambung: {
    judul: "Menyambung ke server…",
    isi: "Tunggu sebentar. Tablet sedang menghubungi server rumah sakit.",
    titik: "bg-warning",
    cincin: "bg-warning-soft text-warning ring-warning/20",
    label: "Menyambung",
  },
  terputus: {
    judul: "Koneksi terputus",
    isi: "Tablet mencoba lagi otomatis. Pastikan tablet tersambung ke Wi-Fi rumah sakit.",
    titik: "bg-danger",
    cincin: "bg-danger-soft text-danger ring-danger/20",
    label: "Terputus",
  },
};

function LayarSiaga({
  nama,
  onNama,
  onTakTerpasang,
  onDiganti,
}: {
  nama: string;
  onNama: (nama: string) => void;
  onTakTerpasang: (pesan: string) => void;
  onDiganti: () => void;
}) {
  const [aktif, setAktif] = useState<PermintaanTabletDto | null>(null);
  const koneksi = useAliranSiaga({
    onNama,
    onTakTerpasang,
    onDiganti,
    // Permintaan yang sama (id + putaran) tidak memasang ulang kanvas → coretan tak hilang saat sambung ulang.
    onPermintaan: (p) => setAktif((lama) => (samaPermintaan(lama, p) ? lama : p)),
    onSelesai: (id) => setAktif((lama) => (lama?.id === id ? null : lama)),
  });
  useLayarMenyala();
  const jam = useJam();
  const t = TAMPIL_KONEKSI[koneksi];
  const Ikon = koneksi === "terputus" ? Unplug : koneksi === "siap" ? PenLine : Wifi;

  if (aktif) {
    return (
      <KanvasPermintaan
        key={`${aktif.id}:${aktif.putaran}`}
        permintaan={aktif}
        onTutup={() => setAktif((lama) => (lama === aktif ? null : lama))}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 py-6 sm:px-10 sm:py-8" data-koneksi={koneksi}>
      <header className="flex items-start justify-between gap-4">
        <Merek />
        <div className="text-right" aria-hidden={!jam}>
          <p className="text-2xl font-semibold tabular text-fg sm:text-3xl">{jam?.jam ?? " "}</p>
          <p className="text-xs text-fg-muted sm:text-sm">{jam?.tanggal ?? " "}</p>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        <span className="relative grid size-28 place-items-center sm:size-32">
          {koneksi === "siap" && (
            <span className="absolute -inset-3 rounded-full bg-success-soft motion-safe:animate-napas" aria-hidden />
          )}
          <span className={cn("relative grid size-full place-items-center rounded-full ring-1 ring-inset", t.cincin)}>
            <Ikon className="size-11 sm:size-12" aria-hidden />
          </span>
        </span>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{t.judul}</h1>
        <p className="mt-3 max-w-md text-base text-fg-muted">{t.isi}</p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <span className="inline-flex min-w-0 items-center gap-2 text-fg">
          <MonitorSmartphone className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          <span className="truncate font-medium" data-nama-perangkat>
            {nama || "Perangkat TTD"}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 text-fg-muted" data-status-koneksi>
          <span className={cn("size-2 rounded-full", t.titik)} aria-hidden />
          {t.label}
        </span>
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------- diganti */

function LayarDiganti({ onPakai }: { onPakai: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-5 py-6 sm:px-10">
      <Merek />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-fg-muted ring-1 ring-inset ring-border">
          <MonitorSmartphone className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Layar siaga dibuka di tempat lain</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Pemasangan ini sedang dipakai di tab atau jendela lain. Satu perangkat hanya bisa siaga di satu layar.
        </p>
        <button
          type="button"
          onClick={onPakai}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-base font-semibold text-brand-fg shadow-xs transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2"
        >
          Pakai di layar ini
        </button>
      </div>
    </div>
  );
}
