"use client";

import { useState } from "react";
import { FileSignature, Printer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { downloadFromEndpoint } from "@/lib/download";
import { bastPdfUrl, type BastInput, type BastPihak, type KirData } from "./kir.client";

const PARA1 =
  "PIHAK PERTAMA menyerahkan dokumen dan barang kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah menerima barang dari PIHAK PERTAMA (daftar dokumen ada dalam lampiran).";
const PARA2 =
  "Demikian berita acara serah terima Barang ini dilakukan oleh KEDUA PIHAK, sejak penandatanganan berita acara ini, semua barang tersebut menjadi TANGGUNG JAWAB PIHAK KEDUA dalam hal penyimpanan dan pemeliharaannya untuk dapat dipakai sesuai kebutuhan.";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh${n % 10 ? ` ${terbilang(n % 10)}` : ""}`;
  if (n < 200) return `seratus${n % 100 ? ` ${terbilang(n % 100)}` : ""}`;
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus${n % 100 ? ` ${terbilang(n % 100)}` : ""}`;
  if (n < 2000) return `seribu${n % 1000 ? ` ${terbilang(n % 1000)}` : ""}`;
  return `${terbilang(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${terbilang(n % 1000)}` : ""}`;
}
function hariTerbilang(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${HARI[dt.getUTCDay()]} ${terbilang(d)} ${BULAN[m - 1]} ${terbilang(y)}`;
}
const p2 = (n: number) => String(n).padStart(2, "0");
function todayWitaIso(): string {
  const w = new Date(Date.now() + 8 * 3600 * 1000);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())}`;
}

const FRENLY: BastPihak = { nama: "Frenly A Mamuaja, A.Md.Kep", nip: "19880803 201201 1 001", jabatan: "Pembantu Pengurus Barang" };

const ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const bulanRomawi = (iso: string) => ROMAWI[Number(iso.slice(5, 7))] ?? "";
/** Susun nomor surat: 044/ RSUD.01/{urut}/{bulan romawi}/{tahun} (bulan & tahun dari tanggal). */
const composeNomor = (urut: string, iso: string) => `044/ RSUD.01/${urut.trim() || "     "}/${bulanRomawi(iso)}/${iso.slice(0, 4)}`;

export function BastPanel({
  data, direkturDefault, canPrint,
}: {
  data: KirData | null;
  direkturDefault: { nama: string; nip: string };
  canPrint: boolean;
}) {
  const toast = useToast();
  const today = todayWitaIso();
  const [tanggal, setTanggal] = useState(today);
  const [nomorUrut, setNomorUrut] = useState("");
  const [p1, setP1] = useState<BastPihak>(FRENLY);
  const [pk2, setPk2] = useState<BastPihak>({ nama: "", nip: "", jabatan: "" });
  const [dir, setDir] = useState<BastPihak>({ nama: "", nip: "", jabatan: "" });
  const [exporting, setExporting] = useState(false);

  // Seed Direktur sekali dari referensi ruangan "Direktur" (fallback template).
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const seedKey = `${direkturDefault.nama}|${direkturDefault.nip}`;
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    setDir({
      nama: direkturDefault.nama || "Dr. Roynald Maramis",
      nip: direkturDefault.nip || "19831027 201903 1 003",
      jabatan: "",
    });
  }

  // PIHAK KEDUA (penerima) = Penanggung Jawab ruangan terpilih; re-seed saat ganti ruangan.
  const [p2Key, setP2Key] = useState<string | null>(null);
  const roomKey = data?.ruangan.id ?? null;
  if (p2Key !== roomKey) {
    setP2Key(roomKey);
    setPk2({
      nama: data?.ruangan.pjNama ?? "",
      nip: data?.ruangan.pjNip ?? "",
      jabatan: data?.ruangan.pjNama ? "Penanggung Jawab Ruangan" : "",
    });
  }

  const nomor = composeNomor(nomorUrut, tanggal);
  const input: BastInput = { nomor, tanggal, pihak1: p1, pihak2: pk2, direktur: dir };

  async function onPrint() {
    if (!data) return;
    setExporting(true);
    try {
      await downloadFromEndpoint(bastPdfUrl(data.ruangan.id, input), `BAST_${data.ruangan.kodePrefix}.pdf`);
      toast.success("Menyiapkan PDF", "Berita Acara Serah Terima Barang sedang diunduh.");
    } catch (e) {
      toast.error("Gagal mencetak", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Pratinjau Berita Acara Serah Terima (BAST)</h3>
            <p className="text-xs text-fg-muted">Cetak PDF resmi ber-kop, lampiran daftar barang & tanda tangan.</p>
          </div>
          <Button size="sm" icon={<Printer className="size-4" />} onClick={onPrint} loading={exporting} disabled={!canPrint || !data}>
            Cetak BAST
          </Button>
        </div>
        {!data ? (
          <EmptyState title="Pilih ruangan" description="Pilih ruangan di kiri untuk membuat berita acara serah terima barangnya." />
        ) : (
          <BastPreview data={data} nomor={nomor} tanggal={tanggal} p1={p1} p2={pk2} dir={dir} />
        )}
      </Card>

      {data && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand"><FileSignature className="size-4" /></span>
            <div>
              <h3 className="text-sm font-semibold text-fg">Data Berita Acara</h3>
              <p className="text-xs text-fg-muted">Nomor, tanggal, para pihak &amp; direktur. Barang mengikuti ruangan terpilih.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="bast-urut">Nomor urut surat</Label>
              <Input id="bast-urut" value={nomorUrut} inputMode="numeric" onChange={(e) => setNomorUrut(e.target.value)} placeholder="mis. 544" />
              <p className="mt-1 text-[11px] text-fg-subtle">Nomor: <span className="font-medium text-fg">{nomor}</span> — bulan (Romawi) &amp; tahun otomatis dari tanggal.</p>
            </div>
            <div>
              <Label htmlFor="bast-tgl">Tanggal Serah Terima</Label>
              <DatePicker id="bast-tgl" value={tanggal} onChange={setTanggal} clearable={false} />
              <p className="mt-1 text-[11px] text-fg-subtle">Dicetak: &quot;Pada hari {hariTerbilang(tanggal) || "…"}&quot;.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PihakEditor title="PIHAK PERTAMA (Menyerahkan)" value={p1} onChange={setP1} />
            <PihakEditor title="PIHAK KEDUA (Penerima — dari PJ Ruangan)" value={pk2} onChange={setPk2} />
            <PihakEditor title="Direktur (Mengetahui)" value={dir} onChange={setDir} hideJabatan />
          </div>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- editor pihak */

function PihakEditor({
  title, value, onChange, hideJabatan,
}: {
  title: string;
  value: BastPihak;
  onChange: (v: BastPihak) => void;
  hideJabatan?: boolean;
}) {
  const set = (patch: Partial<BastPihak>) => onChange({ ...value, ...patch });
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/30 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{title}</p>
      <div className="space-y-2">
        <div>
          <Label>Nama</Label>
          <Input value={value.nama} onChange={(e) => set({ nama: e.target.value })} placeholder="Nama lengkap" />
        </div>
        <div>
          <Label>NIP</Label>
          <Input value={value.nip} onChange={(e) => set({ nip: e.target.value })} placeholder="NIP" />
        </div>
        {!hideJabatan && (
          <div>
            <Label>Jabatan</Label>
            <Input value={value.jabatan} onChange={(e) => set({ jabatan: e.target.value })} placeholder="Jabatan" />
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pratinjau */

function BastPreview({
  data, nomor, tanggal, p1, p2, dir,
}: {
  data: KirData;
  nomor: string;
  tanggal: string;
  p1: BastPihak;
  p2: BastPihak;
  dir: BastPihak;
}) {
  const barang = data.barang;
  return (
    <div className="mx-auto max-w-3xl px-6 py-6 font-serif text-[13px] leading-relaxed text-fg">
      {/* Kop */}
      <div className="border-b-[3px] border-double border-fg pb-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logoboltim.png" alt="Logo RSUD Bolaang Mongondow Timur" className="mx-auto mb-1.5 h-12 w-auto" />
        <p className="text-sm font-bold uppercase tracking-wide">Pemerintah Kabupaten Bolaang Mongondow Timur</p>
        <p className="text-sm font-bold uppercase tracking-wide">UPTD Rumah Sakit Umum Daerah</p>
        <p className="text-[11px] text-fg-muted">Jl. Amurang – Kotamobagu Desa Sumber Rejo Kec. Modayag - Kode Pos 95781</p>
      </div>

      {/* Judul */}
      <div className="mt-4 text-center">
        <p className="inline-block border-b-2 border-fg font-bold uppercase">Berita Acara Serah Terima Barang</p>
        <p className="mt-1 font-semibold">NOMOR : {nomor}</p>
      </div>

      {/* Badan */}
      <p className="mt-4">Pada hari {hariTerbilang(tanggal) || "…"} kami yang bertanda tangan di bawah ini :</p>

      <PihakLines no="1" p={p1} note="Selanjutnya Sebagai PIHAK PERTAMA" />
      <PihakLines no="2" p={p2} note="Selanjutnya Sebagai PIHAK KEDUA" />

      <p className="mt-3 text-justify">{PARA1}</p>
      <p className="mt-2 text-justify">{PARA2}</p>

      {/* Tanda tangan */}
      <div className="mt-6 grid grid-cols-2 gap-4 text-center">
        <SignCol atas="Yang Menyerahkan" bawah="PIHAK PERTAMA" nama={p1.nama} nip={p1.nip} />
        <SignCol atas="Yang Menerima" bawah="PIHAK KEDUA" nama={p2.nama} nip={p2.nip} />
      </div>
      <div className="mt-4 text-center">
        <p>Direktur</p>
        <p>RSUD Bolaang Mongondow Timur</p>
        <div className="h-12" />
        <p className="font-semibold">{dir.nama ? `( ${dir.nama} )` : "( .............................. )"}</p>
        <p className="text-xs text-fg-muted">NIP. {dir.nip || "............................"}</p>
      </div>

      {/* Lampiran */}
      <div className="mt-8 border-t border-dashed border-border pt-5">
        <p className="text-xs font-semibold text-fg-muted">LAMPIRAN — Daftar Barang ({barang.length})</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-surface-2 text-left">
                <Th w="w-10 text-center">NO</Th>
                <Th>NAMA BARANG</Th>
                <Th w="text-center">JUMLAH</Th>
                <Th w="text-center">TAHUN PENGADAAN</Th>
                <Th w="text-center">KETERANGAN</Th>
              </tr>
            </thead>
            <tbody>
              {barang.length === 0 ? (
                <tr><td colSpan={5} className="border border-border px-2 py-3 text-center text-fg-muted">Tidak ada barang pada ruangan ini.</td></tr>
              ) : (
                barang.map((b, i) => (
                  <tr key={b.kodeBarang}>
                    <Td className="text-center tabular-nums">{i + 1}</Td>
                    <Td>{b.nama.toUpperCase()}</Td>
                    <Td className="text-center">1{b.satuan ? ` ${b.satuan.toUpperCase()}` : ""}</Td>
                    <Td className="text-center tabular-nums">{b.tahunPerolehan ?? "-"}</Td>
                    <Td>{b.keterangan ?? ""}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PihakLines({ no, p, note }: { no: string; p: BastPihak; note: string }) {
  return (
    <div className="mt-3">
      <div className="grid grid-cols-[1.2rem_5rem_1fr] gap-x-1">
        <span>{no}.</span><span>Nama</span><span>: {p.nama || "…"}</span>
        <span /><span>NIP</span><span>: {p.nip || "…"}</span>
        <span /><span>Jabatan</span><span>: {p.jabatan || "…"}</span>
      </div>
      <p className="mt-1 pl-[1.2rem]">{note}</p>
    </div>
  );
}

function SignCol({ atas, bawah, nama, nip }: { atas: string; bawah: string; nama: string; nip: string }) {
  return (
    <div>
      <p>{atas}</p>
      <p>{bawah}</p>
      <div className="h-12" />
      <p className="font-semibold">{nama ? `( ${nama} )` : "( .............................. )"}</p>
      <p className="text-xs text-fg-muted">NIP. {nip || "............................"}</p>
    </div>
  );
}

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return <th className={`border border-border px-2 py-1.5 font-semibold ${w ?? ""}`}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`border border-border px-2 py-1.5 align-top ${className ?? ""}`}>{children}</td>;
}
