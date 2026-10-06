import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/report/PrintToolbar";
import { ConsentDocument } from "@/features/form-rm/ConsentDocument";
import { EdukasiDocument } from "@/features/form-rm/EdukasiDocument";
import { RingkasanDocument } from "@/features/form-rm/RingkasanDocument";
import { TriaseDocument } from "@/features/form-rm/TriaseDocument";
import { definisiForm, type Kertas } from "@/features/form-rm/registry";
import { NotFoundError } from "@/server/lib/errors";
import { qrSvgDataUriMap } from "@/server/lib/qr";
import { requireModule } from "@/server/rbac/guard";
import { aktorHalaman } from "@/server/modules/form-rm/isian.jaga";
import { ID_RE } from "@/server/modules/form-rm/isian.schema";
import { bacaIsianCetak, identitasIsian } from "@/server/modules/form-rm/isian.service";
import type {
  ConsentForm,
  EdukasiForm,
  FormRmHeader,
  RingkasanForm,
  TriaseForm,
} from "@/server/modules/form-rm/form-rm.types";
import type { IsianForm } from "@/server/modules/form-rm/isian.types";

export const metadata = { title: "Cetak Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

const UKURAN: Record<Kertas["ukuran"], Record<Kertas["orientasi"], string>> = {
  F4: { potret: "215mm 330mm", lanskap: "330mm 215mm" },
  A4: { potret: "A4 portrait", lanskap: "A4 landscape" },
};

const TANDA_AIR = { DRAF: "DRAF", BATAL: "DIBATALKAN" } as const;

/** Teks aman untuk string CSS `content` (tanpa kutip/backslash/baris baru). */
const teksCss = (s: string) => s.replace(/["\\\n\r]/g, " ");

const waktuCetak = () =>
  `${new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Makassar" }).format(new Date())} WITA`;

/**
 * Cetak satu isian dengan tata letak sesuai versinya (PRD §6.3). Isian non-FINAL
 * diberi tanda air; kaki halaman memuat ID isian, rev, 8 karakter segel, dan
 * waktu cetak. Setiap cetak diaudit.
 */
export default async function CetakIsianPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("form-rm", "print");
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();

  const hasil = await bacaIsianCetak(id, await aktorHalaman(user)).catch((e: unknown) => {
    if (e instanceof NotFoundError) return null;
    throw e;
  });
  if (!hasil) notFound();
  const { isian, segel } = hasil;
  const def = definisiForm(isian.kode);
  if (!def) notFound();
  const header = await identitasIsian(isian);

  const kaki = teksCss(
    `Isian ${isian.id} · ${isian.status} rev ${isian.rev} · segel ${segel ? segel.slice(0, 8) : "—"} · dicetak ${waktuCetak()}`,
  );
  const tandaAir = isian.status === "FINAL" ? null : TANDA_AIR[isian.status];

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${UKURAN[def.kertas.ukuran][def.kertas.orientasi]};
            margin: 8mm;
            @bottom-right { content: "${kaki}"; font: 6.5pt sans-serif; color: #555; }
          }
        }
        .tanda-air-cetak {
          position: fixed; inset: 0; z-index: 40; pointer-events: none;
          display: flex; align-items: center; justify-content: center;
          font: 800 120px/1 sans-serif; letter-spacing: 0.08em;
          color: rgba(190, 30, 30, 0.1); transform: rotate(-30deg);
        }
      `}</style>
      <PrintToolbar
        title={`${def.judul} ${isian.kode} · ${header.nama}`}
        subtitle={`${header.norm} · ${isian.status} rev ${isian.rev}`}
        backHref={`/form-rm/isian/${isian.id}`}
      />
      {tandaAir && (
        <div className="tanda-air-cetak" aria-hidden>
          {tandaAir}
        </div>
      )}
      <Dokumen isian={isian} header={header} />
    </>
  );
}

async function Dokumen({ isian, header }: { isian: IsianForm; header: FormRmHeader }) {
  switch (isian.kode) {
    case "RM.04":
      return <TriaseDocument header={header} data={isian.data as TriaseForm} />;
    case "RM.21": {
      const data = isian.data as EdukasiForm;
      // TTD edukator/dokter = QR berisi nama (bukan tanda tangan gambar).
      const edukatorQr = await qrSvgDataUriMap(data.entries.filter((e) => e.aktif).map((e) => e.edukatorNama));
      return <EdukasiDocument header={header} data={data} edukatorQr={edukatorQr} />;
    }
    case "RM.01":
      return <RingkasanDocument header={header} data={isian.data as RingkasanForm} />;
    case "RM.03":
      return <ConsentDocument header={header} data={isian.data as ConsentForm} />;
  }
}
