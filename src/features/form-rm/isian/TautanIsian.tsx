"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, DoorOpen, Link2, Link2Off, Search, Unlink, UserRoundPen } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { ApiError, apiDelete, apiGet, apiPost, pesanGalat } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { MIN_CARI, tafsirCari } from "@/features/form-rm/cari";
import { ringkasSementara, type IdentitasSementara } from "@/features/form-rm/sementara";
import type { DaftarKandidatTautan, IsianForm, KandidatTautan } from "@/server/modules/form-rm/isian.types";
import { IdentitasSementaraDialog } from "./IdentitasSementaraDialog";
import type { KendaliIsian } from "./useIsian";

/**
 * Pita tautan isian yang dibuat sebelum pasien terdaftar:
 * - belum tertaut → identitas sementara + "Tautkan ke pasien" / "Ubah identitas";
 * - sudah tertaut → asal-usulnya + "Lepas tautan" (draf yang belum pernah
 *   difinalkan & belum memakai data SIMRS; server memeriksa ulang).
 * Isian ditutup (BATAL) memakai pita status biasa.
 */
export function PitaTautan<T>({ kendali: k }: { kendali: KendaliIsian<T> }) {
  const [dialog, setDialog] = useState<"tautkan" | "identitas" | "lepas" | null>(null);
  const { isian, izin } = k;
  const s = isian.sementara;
  if (!s || isian.status === "BATAL") return null;
  const draf = isian.status === "DRAF";
  const bolehUbah = draf && izin.ubah;

  if (!isian.tertaut) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2.5 text-[13px] text-warning"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Link2Off className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <p>
              <b>Belum tertaut</b> ke pasien terdaftar — <span className="font-semibold text-fg">{ringkasSementara(s)}</span>
              {s.ciri && <span className="text-fg-muted"> · {s.ciri}</span>}
            </p>
            <p className="text-fg-muted">
              Setelah pasien didaftarkan di SIMRS, tautkan isian ini ke pendaftarannya. Identitas pasien akan terisi dan
              isian bisa difinalkan.
            </p>
          </div>
        </div>
        {bolehUbah && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<UserRoundPen className="size-4" />}
              onClick={() => setDialog("identitas")}
              disabled={k.sibuk !== null}
            >
              Ubah identitas
            </Button>
            <Button size="sm" icon={<Link2 className="size-4" />} onClick={() => setDialog("tautkan")} disabled={k.sibuk !== null}>
              Tautkan ke pasien
            </Button>
          </div>
        )}
        {dialog === "tautkan" && <TautkanDialog kendali={k} sementara={s} onTutup={() => setDialog(null)} />}
        {dialog === "identitas" && (
          <IdentitasSementaraDialog
            mode={{
              jenis: "ubah",
              isianId: isian.id,
              awal: { sebutan: s.sebutan, jenisKelamin: s.jenisKelamin, perkiraanUmur: s.perkiraanUmur, ciri: s.ciri },
            }}
            onTutup={() => setDialog(null)}
          />
        )}
      </div>
    );
  }

  // Lepas tautan hanya selama belum ada revisi (belum pernah FINAL) & tanpa data SIMRS.
  const bolehLepas = bolehUbah && !isian.difinalkanAt && Object.keys(isian.asal).length === 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-border bg-surface-2/60 px-3 py-2 text-[13px] text-fg-muted">
      <p className="flex min-w-0 items-start gap-2">
        <Link2 className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
        <span>
          Diisi sebelum pasien terdaftar sebagai <b className="font-semibold text-fg">{ringkasSementara(s)}</b>
          {s.ditautkanAt && (
            <>
              , ditautkan {s.ditautkanOlehNama ? `oleh ${s.ditautkanOlehNama} ` : ""}pada {formatDateTime(s.ditautkanAt)}
            </>
          )}
          .
        </span>
      </p>
      {bolehLepas && (
        <Button size="sm" variant="ghost" icon={<Unlink className="size-4" />} onClick={() => setDialog("lepas")} disabled={k.sibuk !== null}>
          Lepas tautan
        </Button>
      )}
      {dialog === "lepas" && <LepasTautanDialog kendali={k} sementara={s} onTutup={() => setDialog(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------------- tautkan */

const selisih = (menit: number) =>
  menit < 60 ? `${menit} mnt` : `${Math.floor(menit / 60)} j${menit % 60 ? ` ${menit % 60} mnt` : ""}`;

const JK_HURUF: Record<string, string> = { "Laki-Laki": "L", Perempuan: "P" };

function TautkanDialog<T>({
  kendali: k,
  sementara: s,
  onTutup,
}: {
  kendali: KendaliIsian<T>;
  sementara: IdentitasSementara;
  onTutup: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cariInput, setCariInput] = useState("");
  const [pilih, setPilih] = useState<KandidatTautan | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<{ pesan: string; isianLain: string | null } | null>(null);
  const cari = useDebounce(cariInput, 400).trim();
  const q = cari !== "" && tafsirCari(cari) !== null ? cari : "";
  const petunjuk = cariInput.trim() !== "" && tafsirCari(cariInput) === null;
  const id = k.isian.id;

  const { result, loading, error, reload } = useAsyncData<DaftarKandidatTautan>(
    () => apiGet<DaftarKandidatTautan>(`/api/form-rm/isian/${id}/tautan${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    [id, q],
  );
  const items = result?.data ?? [];

  async function tautkan() {
    if (!pilih || sibuk) return;
    setSibuk(true);
    setGalat(null);
    try {
      // Simpan dulu perubahan di layar; tautan memakai rev terbaru.
      const rev = await k.rampungkan();
      if (rev === null) throw new Error("Perubahan isian belum tersimpan. Periksa pesan di bilah bawah lalu coba lagi.");
      await apiPost<IsianForm>(`/api/form-rm/isian/${id}/tautan`, { rev, nopen: pilih.nopen });
      toast.success("Isian ditautkan", `${pilih.nama} · No. RM ${pilih.norm}`);
      onTutup();
      router.refresh();
    } catch (e) {
      const lain = e instanceof ApiError ? (e.details as { isianLain?: unknown } | undefined)?.isianLain : undefined;
      setGalat({ pesan: pesanGalat(e), isianLain: typeof lain === "string" ? lain : null });
      setSibuk(false);
    }
  }

  const jkBeda = pilih && s.jenisKelamin && JK_HURUF[pilih.jenisKelamin] && JK_HURUF[pilih.jenisKelamin] !== s.jenisKelamin;

  return (
    <Modal
      open
      onClose={onTutup}
      dismissible={!sibuk}
      size="lg"
      title="Tautkan ke pasien terdaftar"
      description={`Pilih pendaftaran pasien di SIMRS. Identitas sementara “${ringkasSementara(s)}” diganti identitas dari SIMRS.`}
      icon={<Link2 className="mt-0.5 size-4 text-brand" />}
      footer={
        <>
          <Button variant="secondary" onClick={onTutup} disabled={sibuk}>
            Batal
          </Button>
          <Button onClick={tautkan} disabled={!pilih} loading={sibuk} icon={<Link2 className="size-4" />}>
            Tautkan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="cari-tautan">Cari pasien</Label>
          <InputWithIcon
            id="cari-tautan"
            type="search"
            icon={<Search className="size-4" />}
            placeholder="No. RM, NIK, NOPEN, atau nama pasien"
            value={cariInput}
            onChange={(e) => setCariInput(e.target.value)}
            autoComplete="off"
            aria-describedby="cari-tautan-bantu"
          />
          <p id="cari-tautan-bantu" className={cn("mt-1 text-xs", petunjuk ? "text-warning" : "text-fg-subtle")}>
            {petunjuk
              ? `Ketik minimal ${MIN_CARI} karakter: angka saja (No. RM / NIK / NOPEN) atau huruf saja (nama).`
              : result?.mode === "saran"
                ? `Saran: pendaftaran IGD sejak 2 jam sebelum s.d. 48 jam sesudah ${formatDateTime(result.acuan)} — yang belum punya isian lebih dulu, lalu yang waktunya terdekat.`
                : "Kosongkan untuk kembali ke saran."}
          </p>
        </div>

        <div className="max-h-88 overflow-y-auto rounded-[var(--radius-md)] border border-border">
          {loading && !result ? (
            <ul className="divide-y divide-border" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="space-y-1.5 px-3 py-3">
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : items.length === 0 ? (
            <EmptyState
              title={q ? "Pasien tidak ditemukan" : "Belum ada pendaftaran yang cocok"}
              description={
                q
                  ? "Periksa No. RM / NIK / NOPEN, atau coba penggalan nama yang lain."
                  : "Pasien mungkin belum didaftarkan. Cari dengan No. RM, NIK, atau nama bila sudah."
              }
            />
          ) : (
            <ul role="radiogroup" aria-label="Pendaftaran pasien" className={cn("divide-y divide-border", loading && "opacity-60")}>
              {items.map((p) => (
                <li key={p.nopen}>
                  <BarisKandidat p={p} dipilih={pilih?.nopen === p.nopen} onPilih={() => setPilih(p)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {pilih && (
          <p className="text-[13px] text-fg">
            Tautkan ke <b>{pilih.nama}</b> · No. RM <span className="font-mono">{pilih.norm}</span> · NOPEN{" "}
            <span className="font-mono">{pilih.nopen}</span>?
          </p>
        )}
        {jkBeda && (
          <p className="flex items-start gap-1.5 text-[13px] text-warning">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Jenis kelamin di SIMRS ({pilih?.jenisKelamin}) berbeda dengan identitas sementara. Pastikan pasiennya benar.
          </p>
        )}
        {galat && (
          <p className="text-[13px] text-danger">
            {galat.pesan}
            {galat.isianLain && (
              <>
                {" "}
                <Link href={`/form-rm/isian/${galat.isianLain}`} target="_blank" className="font-semibold underline underline-offset-2">
                  Buka isian itu
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </Modal>
  );
}

function BarisKandidat({ p, dipilih, onPilih }: { p: KandidatTautan; dipilih: boolean; onPilih: () => void }) {
  const terpakai = p.isianLain !== null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={dipilih}
      disabled={terpakai}
      onClick={onPilih}
      className={cn(
        "grid w-full grid-cols-1 gap-x-4 gap-y-1 px-3 py-2.5 text-left transition-colors sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
        dipilih ? "bg-brand-soft" : "hover:bg-surface-2/70",
        terpakai && "cursor-not-allowed opacity-60 hover:bg-transparent",
      )}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border",
              dipilih ? "border-brand" : "border-border",
            )}
          >
            {dipilih && <span className="size-2 rounded-full bg-brand" />}
          </span>
          <span className="truncate font-semibold text-fg">{p.nama}</span>
        </span>
        <span className="block pl-6 font-mono text-xs text-fg-muted">
          {p.norm} · NOPEN {p.nopen}
        </span>
        <span className="block pl-6 text-xs text-fg-muted">
          {p.jenisKelamin}
          {p.umur ? ` · ${p.umur}` : ""}
        </span>
      </span>
      <span className="min-w-0 space-y-0.5 pl-6 text-xs text-fg-muted sm:pl-0">
        <span className="flex items-start gap-1.5 text-fg">
          <DoorOpen className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
          <span className="min-w-0">{p.ruang}</span>
        </span>
        <span className="block">
          Masuk {formatDateTime(p.masuk)} · selisih {selisih(p.selisihMenit)}
        </span>
        {terpakai && <Badge tone="neutral">Sudah punya isian form ini</Badge>}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------ lepas tautan */

function LepasTautanDialog<T>({
  kendali: k,
  sementara: s,
  onTutup,
}: {
  kendali: KendaliIsian<T>;
  sementara: IdentitasSementara;
  onTutup: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function lepas() {
    setSibuk(true);
    setGalat(null);
    try {
      const rev = await k.rampungkan();
      if (rev === null) throw new Error("Perubahan isian belum tersimpan. Periksa pesan di bilah bawah lalu coba lagi.");
      await apiDelete<IsianForm>(`/api/form-rm/isian/${k.isian.id}/tautan?rev=${rev}`);
      toast.success("Tautan dilepas", "Isian kembali belum tertaut");
      onTutup();
      router.refresh();
    } catch (e) {
      setGalat(pesanGalat(e));
      setSibuk(false);
    }
  }

  return (
    <Modal
      open
      onClose={onTutup}
      dismissible={!sibuk}
      title="Lepas tautan?"
      description={`Gunakan bila isian tertaut ke pasien yang salah. Isian kembali "Belum tertaut" dengan identitas sementara “${ringkasSementara(s)}”, lalu bisa ditautkan ke pasien yang benar.`}
      icon={<Unlink className="mt-0.5 size-4 text-danger" />}
      footer={
        <>
          <Button variant="secondary" onClick={onTutup} disabled={sibuk}>
            Kembali
          </Button>
          <Button variant="danger" onClick={lepas} loading={sibuk} icon={<Unlink className="size-4" />}>
            Lepas tautan
          </Button>
        </>
      }
    >
      {galat ? <p className="text-sm text-danger">{galat}</p> : <p className="text-sm text-fg-muted">Isi form tidak berubah.</p>}
    </Modal>
  );
}
