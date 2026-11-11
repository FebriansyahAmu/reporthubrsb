import { ArrowRightLeft, GitMerge, Split } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { KODE_BERLANJUT } from "@/features/form-rm/berlanjut";
import { LepasTautanButton } from "@/features/form-rm/isian/LepasTautanButton";
import { LABEL_DASAR_TAUTAN, type EpisodeRingkas } from "@/server/modules/form-rm/rantai.inti";
import type { DetailRantai } from "@/server/modules/form-rm/rantai.service";

/** Jam dinding SIMGOS di field UTC → buang "Z" agar tak digeser zona waktu. */
const masuk = (e: EpisodeRingkas) => (e.masuk ? formatDateTime(e.masuk.slice(0, 19)) : "—");
const DAFTAR_FORM = KODE_BERLANJUT.join(", ");

function Bingkai({ ikon, judul, children, aksi }: { ikon: React.ReactNode; judul: string; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section
      aria-label={judul}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-brand/25 bg-brand-soft/60 p-4 sm:flex-row sm:items-start"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface text-brand ring-1 ring-inset ring-brand/20">
        {ikon}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <h2 className="font-semibold text-fg">{judul}</h2>
        <div className="mt-1 space-y-1 text-fg-muted">{children}</div>
      </div>
      {aksi && <div className="shrink-0">{aksi}</div>}
    </section>
  );
}

/**
 * Rantai IGD → rawat inap di profil pasien (PRD Berlanjut §5.2, §5.5). Episode
 * RI: status tautan ke episode IGD asal (+ lepas tautan untuk pengelola RM).
 * Episode IGD: episode rawat inap yang melanjutkan isiannya.
 */
export function PanelRantai({
  detail,
  lanjutan,
  kelola,
}: {
  detail: DetailRantai | null;
  lanjutan: EpisodeRingkas[];
  kelola: boolean;
}) {
  if (detail) {
    const r = detail.ringkas;
    const akar = detail.akar;
    const t = detail.tautan;
    const lepas = kelola && t ? <LepasTautanButton id={t.id} terpisah={r.status === "terpisah"} /> : undefined;
    if (r.status === "terpisah") {
      return (
        <Bingkai ikon={<Split className="size-4" aria-hidden />} judul="Isian terpisah dari IGD" aksi={lepas}>
          <p>
            {DAFTAR_FORM} episode rawat inap ini memakai dokumen sendiri
            {t ? `, dipilih ${t.olehNama ?? "petugas"} · ${formatDateTime(t.dibuatAt)}` : ""}.
          </p>
        </Bingkai>
      );
    }
    const episode = akar ? (
      <>
        episode IGD · {akar.ruang} · masuk {masuk(akar)} (NOPEN <span className="font-mono">{akar.nopen}</span>)
      </>
    ) : (
      <>episode IGD NOPEN {r.akar}</>
    );
    if (r.status === "konfirmasi") {
      return (
        <Bingkai ikon={<ArrowRightLeft className="size-4" aria-hidden />} judul="Mungkin berlanjut dari IGD">
          <p>
            Pasien ini punya {episode}
            {r.dasar === "WAKTU" ? ", kurang dari 24 jam sebelum rawat inap, tanpa SPRI" : ", tautannya pernah dilepas"}. Petugas
            akan diminta mengonfirmasi saat membuka {DAFTAR_FORM}.
          </p>
        </Bingkai>
      );
    }
    return (
      <Bingkai ikon={<GitMerge className="size-4" aria-hidden />} judul="Berlanjut dari IGD" aksi={lepas}>
        <p>
          {DAFTAR_FORM} perawatan ini memakai dokumen yang sama dengan {episode}.
        </p>
        <p className="text-xs">
          {t
            ? `Ditautkan ${LABEL_DASAR_TAUTAN[t.dasar]} · ${t.olehNama ?? "petugas"} · ${formatDateTime(t.dibuatAt)}`
            : "Akan ditautkan otomatis lewat SPRI saat form dibuka."}
        </p>
      </Bingkai>
    );
  }
  if (lanjutan.length > 0) {
    return (
      <Bingkai ikon={<GitMerge className="size-4" aria-hidden />} judul="Dilanjutkan di rawat inap">
        <p>
          {DAFTAR_FORM} episode IGD ini dipakai bersama oleh{" "}
          {lanjutan.map((l, i) => (
            <span key={l.nopen}>
              {i > 0 ? ", " : ""}
              rawat inap {l.ruang} · masuk {masuk(l)} (NOPEN <span className="font-mono">{l.nopen}</span>)
            </span>
          ))}
          .
        </p>
      </Bingkai>
    );
  }
  return null;
}
