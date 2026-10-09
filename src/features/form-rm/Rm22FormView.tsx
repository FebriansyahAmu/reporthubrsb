"use client";

import { useState } from "react";
import { Check, CircleCheckBig, CircleX, Lock, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { SignaturePad } from "@/features/form-rm/SignaturePad";
import { IsianFrame } from "@/features/form-rm/isian/IsianFrame";
import { BidangIsian, KunciIsian } from "@/features/form-rm/isian/kunci";
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
import { kosong, lengkapiInformasi, type IdInformasi } from "@/features/form-rm/persetujuan/informasi";
import {
  LANGKAH_RM22,
  META_LEMBAR,
  RM22_KOTA,
  TEKS_RM22,
  TTD_PERNYATAAN,
  emptyRm22Form,
  kekuranganRm22,
  statusLangkah,
  type LembarRm22,
  type Rm22Data,
} from "@/features/form-rm/rm22.constants";
import type { FormRmHeader } from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm, IzinIsian } from "@/server/modules/form-rm/isian.types";

/** Data tersimpan → state UI lengkap (baris informasi yang hilang dilengkapi). */
function siapkan(data: unknown): Rm22Data {
  const d = (data && typeof data === "object" ? data : {}) as Partial<Rm22Data>;
  return { ...emptyRm22Form(), ...d, informasi: lengkapiInformasi(d.informasi) };
}

export function Rm22FormView({ isian, header, izin }: { isian: IsianForm; header: FormRmHeader; izin: IzinIsian }) {
  const k = useIsian(isian, izin, siapkan);
  const { form, setForm } = k;
  const [gantiKe, setGantiKe] = useState<LembarRm22 | null>(null);

  const set = <K extends keyof Rm22Data>(key: K, value: Rm22Data[K]) => setForm((f) => ({ ...f, [key]: value }));

  const kurang = kekuranganRm22(form);
  const alur = hitungAlur(LANGKAH_RM22, kurang, (id, x) => statusLangkah(form, id, x), k.terkunci);
  const meta = form.lembar ? META_LEMBAR[form.lembar] : null;
  const pasienNama = header.nama === "—" ? "" : header.nama;

  /* ------------------------------------------------------------- perubahan */

  function setIsiInformasi(id: IdInformasi, isi: string) {
    setForm((f) => {
      const lama = f.informasi[id];
      // Tindakan di pernyataan mengikuti informasi no. 3 selama belum diubah sendiri.
      const ikut = id === "tindakan" && (kosong(f.tindakan) || f.tindakan === lama.isi);
      return { ...f, informasi: ubahIsiInformasi(f.informasi, id, isi), ...(ikut ? { tindakan: isi.slice(0, 300) } : {}) };
    });
  }

  /** TTD pernyataan & saksi terikat pada lembar → ganti lembar mengosongkannya (dengan konfirmasi). */
  function pilihLembar(l: LembarRm22) {
    if (form.lembar === l) return;
    if (TTD_PERNYATAAN.some((s) => form[s] !== "")) setGantiKe(l);
    else set("lembar", l);
  }
  function konfirmasiGanti() {
    if (!gantiKe) return;
    setForm((f) => ({ ...f, lembar: gantiKe, pernyataTtd: "", saksi1Ttd: "", saksi2Ttd: "" }));
    setGantiKe(null);
  }

  const ttdKonteks = (peran: string) => [pasienNama, `RM.22 — ${peran}`].filter(Boolean).join(" · ");

  return (
    <IsianFrame
      kendali={k}
      aksen={
        <span className="inline-flex items-center gap-2">
          <LencanaLembar lembar={form.lembar} ringkas />
          <span className="tabular-nums">
            {alur.jumlahLengkap}/{LANGKAH_RM22.length} langkah
          </span>
        </span>
      }
    >
      <KepalaIsian
        header={header}
        urutan={isian.urutan}
        lencana={<LencanaLembar lembar={form.lembar} />}
        subjekLabel="Tindakan"
        subjek={form.tindakan || form.informasi.tindakan.isi}
      />

      <NavAlur langkah={LANGKAH_RM22} status={alur.status} aktif={alur.aktif} />

      <BidangIsian className="space-y-5">
        {/* 1 — Pihak pemberian informasi */}
        <Langkah {...alur.props("pihak")} judul="Pemberian Informasi"
          desc="Dokter yang melakukan tindakan, dokter yang memberi informasi, dan pasien/keluarga yang menerimanya.">
          <PihakInformasi awalan="rm22" form={form} set={set} pasienNama={pasienNama} />
        </Langkah>

        {/* 2 — Isi informasi */}
        <Langkah {...alur.props("informasi")} judul="Jenis & Isi Informasi"
          desc="Isi setiap jenis informasi yang dijelaskan (tulis “-” bila tidak berlaku). Tanda (V) dicentang setelah penerima memahami informasinya."
          kanan={<MeterInformasi informasi={form.informasi} />}>
          <TabelInformasi awalan="rm22" informasi={form.informasi} onIsi={setIsiInformasi}
            onTanda={(id, tanda) => setForm((f) => ({ ...f, informasi: { ...f.informasi, [id]: { ...f.informasi[id], tanda } } }))}
            onTandaiSemua={() => setForm((f) => ({ ...f, informasi: tandaiSemuaInformasi(f.informasi) }))} />
        </Langkah>

        {/* 3 — TTD pemberian informasi */}
        <Langkah {...alur.props("ttdInformasi")} judul="Tanda Tangan Pemberian Informasi"
          desc="Dokter menyatakan telah menerangkan; penerima menyatakan telah menerima informasi yang ditandainya.">
          <TtdInformasi form={form} set={set} konteks={ttdKonteks} noPihak={1} />
        </Langkah>

        {/* 4 — Keputusan: lembar persetujuan / penolakan */}
        <Langkah {...alur.props("lembar")} judul="Keputusan Pasien / Wali"
          desc="Pilih lembar yang dipakai. Bagian pemberian informasi sama untuk kedua lembar; pernyataan & tanda tangan berikutnya mengikuti lembar ini.">
          <div role="radiogroup" aria-label="Lembar keputusan" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KartuLembar lembar="persetujuan" ikon={CircleCheckBig} dipilih={form.lembar === "persetujuan"} onPilih={() => pilihLembar("persetujuan")} />
            <KartuLembar lembar="penolakan" ikon={CircleX} dipilih={form.lembar === "penolakan"} onPilih={() => pilihLembar("penolakan")} />
          </div>
          {gantiKe && (
            <KonfirmasiGanti id="rm22-ganti-judul" label="Ganti lembar" onBatal={() => setGantiKe(null)} onYa={konfirmasiGanti}>
              Ganti ke <b>{META_LEMBAR[gantiKe].label}</b>? Tanda tangan yang menyatakan dan saksi akan dihapus dan harus dibuat ulang.
            </KonfirmasiGanti>
          )}
        </Langkah>

        {/* 5 — Pernyataan */}
        <Langkah {...alur.props("pernyataan")}
          judul={meta ? `Pernyataan ${meta.kata === "persetujuan" ? "Persetujuan" : "Penolakan"}` : "Pernyataan"}
          desc="Identitas yang menyatakan, tindakan, dan pasien yang menerima tindakan.">
          <div className="space-y-5">
            <BagianYangMenyatakan awalan="rm22" form={form} setForm={setForm} pasienNamaHeader={pasienNama}
              objek="Tindakan" judulPasien="Pasien yang menerima tindakan"
              tengah={
                <div>
                  <Label htmlFor="rm22-tindakan">
                    Dengan ini menyatakan <b className="text-fg">{meta?.kata ?? "persetujuan / penolakan"}</b> untuk dilakukannya tindakan
                  </Label>
                  <Input id="rm22-tindakan" value={form.tindakan} maxLength={300} onChange={(e) => set("tindakan", e.target.value)} placeholder="Nama tindakan kedokteran" />
                  {!kosong(form.informasi.tindakan.isi) && form.tindakan !== form.informasi.tindakan.isi.slice(0, 300) && (
                    <Saran onClick={() => set("tindakan", form.informasi.tindakan.isi.slice(0, 300))}>
                      Sama dengan informasi no. 3: {form.informasi.tindakan.isi}
                    </Saran>
                  )}
                </div>
              } />

            <TempatTanggal id="rm22-tanggal" kota={RM22_KOTA} value={form.tanggal} onChange={(v) => set("tanggal", v)} />

            <PratinjauPernyataan>
              <KalimatIdentitas d={form} />, dengan ini menyatakan <NilaiKalimat nilai={meta?.kata ?? ""} kosongTeks="persetujuan / penolakan" />{" "}
              untuk dilakukannya tindakan <NilaiKalimat nilai={form.tindakan} kosongTeks="tindakan" /> terhadap <KalimatTerhadap d={form} />.{" "}
              {TEKS_RM22.memahami}
            </PratinjauPernyataan>
          </div>
        </Langkah>

        {/* 6 — TTD pernyataan & saksi (terkunci sampai lembar dipilih) */}
        <Langkah {...alur.props("ttdPernyataan")} judul="Tanda Tangan Yang Menyatakan & Saksi"
          desc="Ditandatangani setelah keputusan dipilih. Minimal satu saksi (mis. perawat atau keluarga).">
          {!form.lembar && (
            <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-fg">
              <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              Pilih keputusan di langkah 4 lebih dulu — tanda tangan terikat pada lembar persetujuan atau penolakan.
            </p>
          )}
          <KunciIsian terkunci={k.terkunci || !form.lembar}>
            <BidangIsian>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <KotakTtd ikon={UserRound} peran="Yang menyatakan" nama={form.pernyataNama} kosongNama="Isi nama di langkah 5">
                  <SignaturePad label="Tanda tangan yang menyatakan" value={form.pernyataTtd} onChange={(v) => set("pernyataTtd", v)}
                    context={ttdKonteks(meta ? `${meta.label} — yang menyatakan` : "Yang menyatakan")}
                    reuse={samaNama(form.pernyataNama, form.penerimaInformasi) ? form.penerimaTtd : ""} />
                </KotakTtd>
                <KotakSaksi no={1} nama={form.saksi1Nama} ttd={form.saksi1Ttd} onNama={(v) => set("saksi1Nama", v)} onTtd={(v) => set("saksi1Ttd", v)} konteks={ttdKonteks("Saksi 1")} />
                <KotakSaksi no={2} nama={form.saksi2Nama} ttd={form.saksi2Ttd} onNama={(v) => set("saksi2Nama", v)} onTtd={(v) => set("saksi2Ttd", v)} konteks={ttdKonteks("Saksi 2")} />
              </div>
            </BidangIsian>
          </KunciIsian>
        </Langkah>
      </BidangIsian>

      <RingkasanKekurangan langkah={LANGKAH_RM22} kurang={kurang} terkunci={k.terkunci} />
    </IsianFrame>
  );
}

/* ================================================================ lencana */

function LencanaLembar({ lembar, ringkas }: { lembar: Rm22Data["lembar"]; ringkas?: boolean }) {
  if (lembar === "persetujuan") {
    return (
      <Badge tone="success">
        <CircleCheckBig className="size-3.5" aria-hidden />
        {ringkas ? "Persetujuan" : "Lembar Persetujuan"}
      </Badge>
    );
  }
  if (lembar === "penolakan") {
    return (
      <Badge tone="danger">
        <CircleX className="size-3.5" aria-hidden />
        {ringkas ? "Penolakan" : "Lembar Penolakan"}
      </Badge>
    );
  }
  return (
    <Badge tone="warning" dot>
      {ringkas ? "Keputusan belum dipilih" : "Lembar belum dipilih"}
    </Badge>
  );
}

function KartuLembar({ lembar, ikon: Ikon, dipilih, onPilih }: { lembar: LembarRm22; ikon: LucideIcon; dipilih: boolean; onPilih: () => void }) {
  const m = META_LEMBAR[lembar];
  const setuju = lembar === "persetujuan";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dipilih}
      data-lembar={lembar}
      onClick={onPilih}
      className={cn(
        "group relative flex items-start gap-3 rounded-[var(--radius-lg)] border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        dipilih ? (setuju ? "border-success bg-success-soft" : "border-danger bg-danger-soft") : "border-border bg-surface hover:border-border-strong hover:bg-surface-2/50",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
          dipilih ? (setuju ? "bg-success text-white" : "bg-danger text-white") : setuju ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
      >
        <Ikon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-fg">{m.label}</span>
        <span className="block text-sm text-fg-muted">{m.ringkas}</span>
        <span className="mt-2 block text-[11px] font-medium tracking-wide text-fg-subtle">{m.judul}</span>
      </span>
      {dipilih && (
        <span className={cn("absolute right-3 top-3 flex size-6 items-center justify-center rounded-full text-white", setuju ? "bg-success" : "bg-danger")}>
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      )}
    </button>
  );
}
