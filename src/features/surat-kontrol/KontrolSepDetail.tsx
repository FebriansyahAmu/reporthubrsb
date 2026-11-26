"use client";

import { CalendarClock, DoorOpen, FilePen, IdCard } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { JENIS_KONTROL } from "@/server/modules/surat-kontrol/surat-kontrol.constants";
import { selisihHari } from "@/server/modules/surat-kontrol/surat-kontrol.pulang";
import { namaRuanganSep, teksSelisihSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep";
import { LAYANAN_SEP, STATUS_SEP, type StatusSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep.constants";
import type { SepKontrol } from "@/server/modules/surat-kontrol/surat-kontrol.sep.types";
import { JejakEntri, LencanaStatusSep, warnaStatusSep } from "./sep.ui";

type Kejadian = { kunci: string; tanggal: string | null; urut: number; isi: React.ReactNode };
type Baris = [string, string | null, boolean?];

const tgl = (t: string | null | undefined) => (t ? formatDate(t) : "—");
const kn = (x: { kode: string; nama: string | null } | null) => (x ? (x.nama ?? x.kode) : null);

/**
 * Laci rincian satu surat: urutan KUNJUNGAN ASAL → SURAT DIENTRI DI BPJS →
 * SEP DIBUAT (atau RENCANA KONTROL bila belum dipakai SEP), menurut tanggal;
 * pada hari yang sama urutannya asal, surat, SEP. Lalu saran tindak lanjut.
 */
export function KontrolSepDetail({ e, hariIni }: { e: SepKontrol; hariIni: string }) {
  const w = warnaStatusSep(e.status);
  const s = e.surat;
  const jenis = JENIS_KONTROL[s.jenis].label;

  const kejadian: Kejadian[] = [];
  if (e.asal) {
    const ri = e.asal.layanan === "RI";
    const t = ri ? (e.asal.tglPulang ?? e.asal.tglSep) : e.asal.tglSep;
    kejadian.push({
      kunci: "asal",
      tanggal: t,
      urut: 0,
      isi: (
        <Langkah ikon={DoorOpen} judul={ri ? "Pasien pulang rawat inap" : e.asal.layanan === "RJ" ? "Kunjungan rawat jalan sebelumnya" : "Kunjungan asal surat"} waktu={tgl(t)}>
          <Rincian
            data={[
              ["SEP asal", e.asal.sep, true],
              ["Layanan", e.asal.layanan ? LAYANAN_SEP[e.asal.layanan].label : null],
              ...(ri ? [["Tanggal SEP RI", tgl(e.asal.tglSep)] as Baris] : []),
              ...(e.hariSejakPulangAsal != null ? [["Pulang → SEP kontrol", `${e.hariSejakPulangAsal} hari`] as Baris] : []),
            ]}
          />
        </Langkah>
      ),
    });
  }
  kejadian.push({
    kunci: "surat",
    tanggal: s.tglTerbit,
    urut: 1,
    isi: (
      <Langkah ikon={FilePen} judul={`${jenis} dientri di BPJS`} waktu={s.tglTerbit ? formatDate(s.tglTerbit) : "Tanggal belum terbaca"} nada={e.sep ? e.status : undefined}>
        <Rincian
          data={[
            ["No. surat", s.noSurat, true],
            ["Jenis", `${jenis} (kode ${s.jenis})`],
            ["Penerbit (SIMGOS)", s.pembuat ?? "Tidak tercatat di SIMGOS"],
            ["Rencana", tgl(s.tglRencana)],
            ["Poli tujuan", kn(s.poliTujuan)],
            ["Dokter", kn(s.dokter)],
            ["Sumber tanggal", s.asalTerbit === "LIVE" ? "BPJS (live)" : s.asalTerbit === "CACHE" ? "Cache BPJS di SIMGOS" : null],
            ...(!s.aktif ? [["Status surat", "Dihapus di SIMGOS"] as Baris] : []),
          ]}
        />
      </Langkah>
    ),
  });
  if (e.sep) {
    const p = e.sep;
    kejadian.push({
      kunci: "sep",
      tanggal: p.tglSep,
      urut: 2,
      isi: (
        <Langkah ikon={IdCard} judul="SEP dibuat" waktu={`${formatDate(p.tglSep)}${p.jamSep ? ` · ${p.jamSep.replace(":", ".")}` : ""}`}>
          <Rincian
            data={[
              ["No. SEP", p.sep, true],
              ["Layanan", LAYANAN_SEP[p.layanan].label],
              [p.layanan === "RI" ? "Ruangan" : "Poli", namaRuanganSep(e)],
              ["Pembuat SEP", p.pembuatSep],
              ["NOPEN", e.nopen, true],
              ...(p.jumlahSep > 1 ? [["Catatan", `Surat dipakai ${p.jumlahSep} SEP; yang ditampilkan SEP pertama`] as Baris] : []),
            ]}
          />
        </Langkah>
      ),
    });
  } else {
    kejadian.push({
      kunci: "rencana",
      tanggal: s.tglRencana,
      urut: 2,
      isi: (
        <Langkah ikon={CalendarClock} judul="Rencana kontrol" waktu={formatDate(s.tglRencana)} nada={e.status}>
          <Rincian
            data={[
              ["SEP pemakai", e.status === "SEP_TAK_TERCATAT" ? "BPJS: sudah terbit, tetapi tidak ada di SIMGOS" : "Belum ada"],
              ["No. kartu BPJS", e.noKartu, true],
            ]}
          />
        </Langkah>
      ),
    });
  }
  // Tanggal kosong diletakkan pada urutan bawaannya: asal paling awal, surat (belum terbaca) sebelum langkah terakhir.
  const akhir = e.sep?.tglSep ?? s.tglRencana;
  const kunciUrut = (k: Kejadian) => k.tanggal ?? (k.kunci === "asal" ? "0000-00-00" : akhir);
  kejadian.sort((a, b) => kunciUrut(a).localeCompare(kunciUrut(b)) || a.urut - b.urut);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-fg">{e.pasien ?? "Tanpa nama"}</p>
            <p className="font-mono text-[11px] text-fg-subtle">
              {e.norm ? `RM ${e.norm} · ` : ""}
              {e.sep ? `SEP ${e.sep.sep}` : `Kartu ${e.noKartu ?? "—"}`}
            </p>
          </div>
          <LencanaStatusSep s={e.status} />
        </div>
        <div className={cn("mt-3 flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5", w.lembut)}>
          <JejakEntri selisih={e.selisihHari} status={e.status} />
          <p className="text-xs text-fg">
            <b className={cn("font-semibold", w.teks)}>
              {jenis}: {teksSelisihSep(e).toLowerCase()}.
            </b>{" "}
            {STATUS_SEP[e.status].jelas}
          </p>
        </div>
      </div>

      <section aria-labelledby="ksd-jejak">
        <h3 id="ksd-jejak" className="mb-3 text-xs font-semibold text-fg-muted">Urutan kejadian</h3>
        <ol>
          {kejadian.map((k, i) => (
            <li key={k.kunci} className={cn("relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3", i < kejadian.length - 1 && "pb-5")}>
              {i < kejadian.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-border-strong" aria-hidden />}
              {k.isi}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ksd-saran" className="rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 py-2.5">
        <h3 id="ksd-saran" className="text-xs font-semibold text-fg">Tindak lanjut</h3>
        <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">{saran(e, hariIni)}</p>
      </section>
    </div>
  );
}

function saran(e: SepKontrol, hariIni: string): string {
  const kontrol = e.surat.jenis === 2;
  const nama = kontrol ? "Surat Kontrol" : "SPRI";
  switch (e.status) {
    case "SAMA_HARI":
      if (kontrol && e.asal?.layanan === "RI")
        return `Surat Kontrol baru dibuat di hari kontrol. Seharusnya diterbitkan saat pasien pulang rawat inap${e.asal.tglPulang ? ` (${formatDate(e.asal.tglPulang)})` : ""} — lihat tab “Terbit saat pulang” untuk episode tersebut.`;
      if (kontrol) return "Surat Kontrol baru dibuat di hari kontrol. Seharusnya diterbitkan pada kunjungan sebelumnya, di hari pasien selesai dilayani.";
      return "SPRI dientri di hari yang sama dengan SEP rawat inap.";
    case "SETELAH_SEP":
      return `${nama} dientri ${e.selisihHari} hari setelah SEP dibuat. Telusuri mengapa SEP sudah terbit sebelum suratnya tersedia di BPJS.`;
    case "TAK_TERBACA":
      return "Tekan “Segarkan dari BPJS” untuk membaca tanggal entri surat ini dari BPJS.";
    case "SEBELUM_SEP":
      return `${nama} sudah tersedia di BPJS sebelum hari SEP.`;
    case "SEP_TAK_TERCATAT":
      return "BPJS mencatat surat ini sudah dipakai SEP, tetapi SEP-nya tidak ada (atau batal) di SIMGOS — kemungkinan SEP dibuat langsung di VClaim. Periksa SEP di VClaim.";
    case "BELUM_DIPAKAI": {
      const lewat = selisihHari(hariIni, e.surat.tglRencana);
      return lewat > 0
        ? `Rencana ${formatDate(e.surat.tglRencana)} sudah lewat ${lewat} hari dan surat belum dipakai SEP — pasien belum/tidak datang, atau datang di hari lain tanpa memakai surat ini.`
        : `Rencana ${lewat === 0 ? "hari ini" : formatDate(e.surat.tglRencana)}; surat belum dipakai SEP.`;
    }
  }
}

function Langkah({
  ikon: Ikon,
  judul,
  waktu,
  nada,
  children,
}: {
  ikon: typeof DoorOpen;
  judul: string;
  waktu: string;
  nada?: StatusSep;
  children: React.ReactNode;
}) {
  const w = nada ? warnaStatusSep(nada) : null;
  return (
    <>
      <span className={cn("relative grid size-8 place-items-center rounded-full ring-4 ring-surface", w ? cn(w.lembut, w.teks) : "bg-surface-2 text-fg-muted")}>
        <Ikon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 pt-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-fg">{judul}</span>
          <span className={cn("text-xs font-medium tabular", w ? w.teks : "text-fg-muted")}>{waktu}</span>
        </p>
        <div className="mt-1.5">{children}</div>
      </div>
    </>
  );
}

function Rincian({ data }: { data: Baris[] }) {
  return (
    <dl className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {data.map(([k, v, mono]) => (
        <div key={k} className="contents">
          <dt className="text-fg-subtle">{k}</dt>
          <dd className={cn("min-w-0 break-words text-fg", mono && "font-mono text-[11px]", !v && "text-fg-subtle")}>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
