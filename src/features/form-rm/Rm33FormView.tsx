"use client";

import { useState } from "react";
import { Check, CircleCheckBig, CirclePause, CircleX, Lock, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DatePicker, nowLocalDateTime } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian, KunciIsian } from "@/features/form-rm/isian/kunci";
import { LabelAsal } from "@/features/form-rm/isian/TandaAsal";
import { useIsian } from "@/features/form-rm/isian/useIsian";
import { hitungAlur, Langkah, NavAlur, RingkasanKekurangan } from "@/features/form-rm/persetujuan/alur";
import {
  BagianYangMenyatakan,
  KalimatIdentitas,
  KalimatTerhadap,
  KepalaIsian,
  KonfirmasiGanti,
  KotakSaksi,
  KotakTtd,
  MeterInformasi,
  NilaiKalimat,
  PihakInformasi,
  PratinjauPernyataan,
  samaNama,
  Saran,
  TabelInformasi,
  tandaiSemuaInformasi,
  TempatTanggal,
  TtdInformasi,
  ubahIsiInformasi,
} from "@/features/form-rm/persetujuan/bidang";
import { kosong, lengkapiInformasi, tanggalPanjang } from "@/features/form-rm/persetujuan/informasi";
import {
  KEPUTUSAN_RM33,
  LANGKAH_RM33,
  META_KEPUTUSAN,
  META_LEMBAR_RM33,
  RM33_KOTA,
  TEKS_RM33,
  TTD_PERNYATAAN_RM33,
  emptyRm33Form,
  kekuranganRm33,
  keTujuan,
  statusLangkahRm33,
  tindakanRujukan,
  type KeputusanRm33,
  type Rm33Data,
} from "@/features/form-rm/rm33.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/** Data tersimpan → state UI lengkap (baris informasi yang hilang dilengkapi). */
function siapkan(data: unknown): Rm33Data {
  const d = (data && typeof data === "object" ? data : {}) as Partial<Rm33Data>;
  return { ...emptyRm33Form(), ...d, informasi: lengkapiInformasi(d.informasi) };
}

const IKON_KEPUTUSAN: Record<KeputusanRm33, LucideIcon> = { setuju: CircleCheckBig, menunda: CirclePause, menolak: CircleX };

/** Warna per keputusan: setuju hijau, menunda kuning, menolak merah. */
const NADA_KEPUTUSAN: Record<KeputusanRm33, { kartu: string; ikon: string; ikonPasif: string; centang: string }> = {
  setuju: { kartu: "border-success bg-success-soft", ikon: "bg-success text-white", ikonPasif: "bg-success-soft text-success", centang: "bg-success" },
  menunda: { kartu: "border-warning bg-warning-soft", ikon: "bg-warning text-white", ikonPasif: "bg-warning-soft text-warning", centang: "bg-warning" },
  menolak: { kartu: "border-danger bg-danger-soft", ikon: "bg-danger text-white", ikonPasif: "bg-danger-soft text-danger", centang: "bg-danger" },
};

export function Rm33FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [gantiKe, setGantiKe] = useState<KeputusanRm33 | null>(null);

  const set = <K extends keyof Rm33Data>(key: K, value: Rm33Data[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kurang = kekuranganRm33(form);
  const alur = hitungAlur(LANGKAH_RM33, kurang, (id, x) => statusLangkahRm33(form, id, x), k.terkunci);
  const keputusan = form.keputusan ? META_KEPUTUSAN[form.keputusan] : null;
  const pasienNama = header.nama === "—" ? "" : header.nama;
  const ke = keTujuan(form.tujuanRujukan);
  const saranTindakan = tindakanRujukan(form.tujuanRujukan);

  /* ------------------------------------------------------------- perubahan */

  /** TTD pernyataan, dokter, & saksi terikat pada keputusan → mengganti keputusan mengosongkannya (dengan konfirmasi). */
  function pilihKeputusan(x: KeputusanRm33) {
    if (form.keputusan === x) return;
    if (TTD_PERNYATAAN_RM33.some((s) => form[s] !== "")) setGantiKe(x);
    else set("keputusan", x);
  }
  function konfirmasiGanti() {
    if (!gantiKe) return;
    setForm((f) => ({ ...f, keputusan: gantiKe, pernyataTtd: "", dokterTtd: "", saksi1Ttd: "", saksi2Ttd: "" }));
    setGantiKe(null);
  }

  const ttdKonteks = (peran: string) => [pasienNama, `RM.33 — ${peran}`].filter(Boolean).join(" · ");

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          <LencanaKeputusan keputusan={form.keputusan} ringkas />
          <span className="tabular-nums">
            {alur.jumlahLengkap}/{LANGKAH_RM33.length} langkah
          </span>
        </span>
      }
    >
      <KepalaIsian
        header={header}
        urutan={isian.urutan}
        lencana={<LencanaKeputusan keputusan={form.keputusan} />}
        subjekLabel="Rujukan"
        subjek={[ke, tanggalPanjang(form.tanggalRujuk)].filter(Boolean).join(" · ")}
      />

      <NavAlur langkah={LANGKAH_RM33} status={alur.status} aktif={alur.aktif} />

      <BidangIsian className="space-y-5">
        {/* 1 — Rencana rujukan */}
        <Langkah {...alur.props("rujukan")} judul="Rencana Rujukan"
          desc="Rumah sakit / fasilitas tujuan dan tanggal rujuk. Terisi otomatis bila surat rujukan keluar sudah dibuat di SIMRS.">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <LabelAsal path="tujuanRujukan" htmlFor="rm33-tujuan">Dirujuk ke (rumah sakit / fasilitas tujuan)</LabelAsal>
              <Input id="rm33-tujuan" value={form.tujuanRujukan} maxLength={200} onChange={(e) => set("tujuanRujukan", e.target.value)}
                placeholder="mis. RSUP Prof. Dr. R. D. Kandou Manado (Penyakit Dalam)" />
              <p className="mt-1.5 text-xs text-fg-subtle">Cukup nama faskes (dan poli). Kata “ke” ditambahkan otomatis pada pernyataan.</p>
            </div>
            <div>
              <LabelAsal path="tanggalRujuk" htmlFor="rm33-tgl-rujuk">Tanggal rujuk</LabelAsal>
              <DatePicker id="rm33-tgl-rujuk" value={form.tanggalRujuk} onChange={(v) => set("tanggalRujuk", v)} placeholder="Pilih tanggal" />
              {!form.tanggalRujuk && <Saran onClick={() => set("tanggalRujuk", nowLocalDateTime().slice(0, 10))}>Rujuk hari ini</Saran>}
            </div>
          </div>
        </Langkah>

        {/* 2 — Pihak pemberian informasi */}
        <Langkah {...alur.props("pihak")} judul="Pemberian Informasi"
          desc="Dokter yang merujuk (pelaksana), dokter yang memberi informasi, dan pasien/keluarga yang menerimanya.">
          <PihakInformasi awalan="rm33" form={form} set={set} pasienNama={pasienNama} />
        </Langkah>

        {/* 3 — Isi informasi */}
        <Langkah {...alur.props("informasi")} judul="Jenis & Isi Informasi"
          desc="Isi setiap jenis informasi tentang rujukan (tulis “-” bila tidak berlaku). Tanda (V) dicentang setelah penerima memahami informasinya."
          kanan={<MeterInformasi informasi={form.informasi} />}>
          <TabelInformasi awalan="rm33" informasi={form.informasi}
            onIsi={(id, isi) => setForm((f) => ({ ...f, informasi: ubahIsiInformasi(f.informasi, id, isi) }))}
            onTanda={(id, tanda) => setForm((f) => ({ ...f, informasi: { ...f.informasi, [id]: { ...f.informasi[id], tanda } } }))}
            onTandaiSemua={() => setForm((f) => ({ ...f, informasi: tandaiSemuaInformasi(f.informasi) }))}
            saran={{
              tindakan:
                saranTindakan && form.informasi.tindakan.isi.trim() !== saranTindakan ? (
                  <Saran onClick={() => setForm((f) => ({ ...f, informasi: ubahIsiInformasi(f.informasi, "tindakan", saranTindakan) }))}>
                    Isi: {saranTindakan}
                  </Saran>
                ) : null,
            }} />
        </Langkah>

        {/* 4 — TTD pemberian informasi */}
        <Langkah {...alur.props("ttdInformasi")} judul="Tanda Tangan Pemberian Informasi"
          desc="Dokter menyatakan telah menerangkan; penerima menyatakan telah menerima informasi yang ditandainya.">
          <TtdInformasi form={form} set={set} konteks={ttdKonteks} noPihak={2} />
        </Langkah>

        {/* 5 — Keputusan: setuju / menunda / menolak */}
        <Langkah {...alur.props("keputusan")} judul="Keputusan Pasien / Wali"
          desc="Setuju memakai lembar Persetujuan Rujukan; menunda atau menolak memakai lembar Penundaan & Penolakan Rujukan. Pernyataan & tanda tangan berikutnya mengikuti keputusan ini.">
          <div role="radiogroup" aria-label="Keputusan rujukan" className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {KEPUTUSAN_RM33.map((x) => (
              <KartuKeputusan key={x} keputusan={x} dipilih={form.keputusan === x} onPilih={() => pilihKeputusan(x)} />
            ))}
          </div>
          {keputusan && !gantiKe && (
            <p className="mt-3 rounded-[var(--radius-md)] bg-surface-2/60 px-3 py-2 text-xs text-fg-muted">
              Tercetak pada <b className="text-fg">{META_LEMBAR_RM33[keputusan.lembar].label}</b>:{" "}
              {keputusan.lembar === "persetujuan" ? (
                <>“Dengan ini menyatakan <b className="text-fg">SETUJU</b> untuk rujuk …”</>
              ) : (
                <>
                  “dengan ini menyatakan <KataPilihan pilih={form.keputusan === "menunda"}>MENUNDA</KataPilihan>/
                  <KataPilihan pilih={form.keputusan === "menolak"}>MENOLAK</KataPilihan> untuk rujuk …” — pilihan lain dicoret.
                </>
              )}
            </p>
          )}
          {gantiKe && (
            <KonfirmasiGanti id="rm33-ganti-judul" label="Ganti keputusan" onBatal={() => setGantiKe(null)} onYa={konfirmasiGanti}>
              Ganti ke <b>{META_KEPUTUSAN[gantiKe].label}</b>? Tanda tangan yang menyatakan, dokter, dan saksi akan dihapus dan harus dibuat
              ulang.
            </KonfirmasiGanti>
          )}
        </Langkah>

        {/* 6 — Pernyataan */}
        <Langkah {...alur.props("pernyataan")}
          judul={keputusan ? `Pernyataan ${keputusan.lencana} Rujukan` : "Pernyataan"}
          desc="Identitas yang menyatakan dan pasien yang dirujuk; tanggal & tujuan rujukan diambil dari langkah 1.">
          <div className="space-y-5">
            <BagianYangMenyatakan awalan="rm33" form={form} setForm={setForm} pasienNamaHeader={pasienNama}
              objek="Rujukan" judulPasien="Pasien yang dirujuk" />

            <TempatTanggal id="rm33-tanggal" kota={RM33_KOTA} value={form.tanggal} onChange={(v) => set("tanggal", v)} />

            <PratinjauPernyataan>
              <KalimatIdentitas d={form} />, dengan ini menyatakan <NilaiKalimat nilai={keputusan?.kata ?? ""} kosongTeks="setuju / menunda / menolak" />{" "}
              untuk rujuk tanggal <NilaiKalimat nilai={tanggalPanjang(form.tanggalRujuk)} kosongTeks="tanggal" />{" "}
              <NilaiKalimat nilai={ke} kosongTeks="ke tujuan" /> terhadap <KalimatTerhadap d={form} />. {TEKS_RM33.memahami}{" "}
              <NilaiKalimat nilai={ke} kosongTeks="ke tujuan" /> {TEKS_RM33.memahamiLanjut}
            </PratinjauPernyataan>
          </div>
        </Langkah>

        {/* 7 — TTD pernyataan, dokter & saksi (terkunci sampai keputusan dipilih) */}
        <Langkah {...alur.props("ttdPernyataan")} judul="Tanda Tangan Yang Menyatakan, Dokter & Saksi"
          desc="Ditandatangani setelah keputusan dipilih. Dokter = dokter yang menindak; minimal satu saksi (mis. perawat atau keluarga).">
          {!form.keputusan && (
            <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-fg">
              <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              Pilih keputusan di langkah 5 lebih dulu — tanda tangan terikat pada keputusan setuju, menunda, atau menolak.
            </p>
          )}
          <KunciIsian terkunci={k.terkunci || !form.keputusan}>
            <BidangIsian>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                <KotakTtd ikon={UserRound} peran="Yang menyatakan" nama={form.pernyataNama} kosongNama="Isi nama di langkah 6">
                  <SignaturePad label="Tanda tangan yang menyatakan" value={form.pernyataTtd} onChange={(v) => set("pernyataTtd", v)}
                    context={ttdKonteks(keputusan ? `${keputusan.label} — yang menyatakan` : "Yang menyatakan")}
                    reuse={samaNama(form.pernyataNama, form.penerimaInformasi) ? form.penerimaTtd : ""} />
                </KotakTtd>
                <KotakTtd ikon={Stethoscope} peran="Dokter" nama={form.dokterNama}>
                  <LabelAsal path="dokterNama" htmlFor="rm33-dokter">Nama dokter</LabelAsal>
                  <Input id="rm33-dokter" value={form.dokterNama} maxLength={120} onChange={(e) => set("dokterNama", e.target.value)}
                    placeholder="Nama dokter yang menindak" />
                  <div className="mb-3 flex flex-wrap gap-x-1.5">
                    {!kosong(form.dokterPelaksana) && !samaNama(form.dokterNama, form.dokterPelaksana) && (
                      <Saran onClick={() => set("dokterNama", form.dokterPelaksana)}>Dokter pelaksana: {form.dokterPelaksana}</Saran>
                    )}
                    {!kosong(form.pemberiInformasi) && !samaNama(form.dokterNama, form.pemberiInformasi) &&
                      !samaNama(form.dokterPelaksana, form.pemberiInformasi) && (
                        <Saran onClick={() => set("dokterNama", form.pemberiInformasi)}>Pemberi informasi: {form.pemberiInformasi}</Saran>
                      )}
                  </div>
                  <SignaturePad label="Tanda tangan dokter" value={form.dokterTtd} onChange={(v) => set("dokterTtd", v)}
                    context={ttdKonteks(keputusan ? `${keputusan.label} — dokter` : "Dokter")}
                    reuse={samaNama(form.dokterNama, form.pemberiInformasi) ? form.pemberiTtd : ""} />
                </KotakTtd>
                <KotakSaksi no={1} nama={form.saksi1Nama} ttd={form.saksi1Ttd} onNama={(v) => set("saksi1Nama", v)} onTtd={(v) => set("saksi1Ttd", v)} konteks={ttdKonteks("Saksi 1")} />
                <KotakSaksi no={2} nama={form.saksi2Nama} ttd={form.saksi2Ttd} onNama={(v) => set("saksi2Nama", v)} onTtd={(v) => set("saksi2Ttd", v)} konteks={ttdKonteks("Saksi 2")} />
              </div>
              <p className="mt-3 text-xs text-fg-subtle">Penanda tangan lazim: {TEKS_RM33.catatanTtd}.</p>
            </BidangIsian>
          </KunciIsian>
        </Langkah>
      </BidangIsian>

      <RingkasanKekurangan langkah={LANGKAH_RM33} kurang={kurang} terkunci={k.terkunci} />
    </IsianFrame>
  );
}

/* ================================================================ lencana */

function LencanaKeputusan({ keputusan, ringkas }: { keputusan: Rm33Data["keputusan"]; ringkas?: boolean }) {
  if (!keputusan) {
    return (
      <Badge tone="neutral" dot>
        Keputusan belum dipilih
      </Badge>
    );
  }
  const m = META_KEPUTUSAN[keputusan];
  const Ikon = IKON_KEPUTUSAN[keputusan];
  return (
    <Badge tone={m.nada}>
      <Ikon className="size-3.5" aria-hidden />
      {ringkas ? m.lencana : m.label}
    </Badge>
  );
}

/** "MENUNDA/MENOLAK" seperti tercetak: pilihan yang tidak dipilih dicoret. */
function KataPilihan({ pilih, children }: { pilih: boolean; children: React.ReactNode }) {
  return <span className={pilih ? "font-semibold text-fg" : "line-through opacity-70"}>{children}</span>;
}

function KartuKeputusan({ keputusan, dipilih, onPilih }: { keputusan: KeputusanRm33; dipilih: boolean; onPilih: () => void }) {
  const m = META_KEPUTUSAN[keputusan];
  const nada = NADA_KEPUTUSAN[keputusan];
  const Ikon = IKON_KEPUTUSAN[keputusan];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dipilih}
      data-keputusan={keputusan}
      onClick={onPilih}
      className={cn(
        "relative flex items-start gap-3 rounded-[var(--radius-lg)] border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        dipilih ? nada.kartu : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/50",
      )}
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full transition-colors", dipilih ? nada.ikon : nada.ikonPasif)}>
        <Ikon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 pr-6">
        <span className="block text-base font-semibold text-fg">{m.label}</span>
        <span className="block text-sm text-fg-muted">{m.ringkas}</span>
        <span className="mt-2 block text-[11px] font-medium tracking-wide text-fg-subtle">{META_LEMBAR_RM33[m.lembar].label}</span>
      </span>
      {dipilih && (
        <span className={cn("absolute right-3 top-3 flex size-6 items-center justify-center rounded-full text-white", nada.centang)}>
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      )}
    </button>
  );
}
