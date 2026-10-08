import "server-only";
import type { FormRmIsian } from "@/generated/app/client";
import { writeAudit } from "@/server/lib/audit";
import type { Aktor } from "./isian.types";

/**
 * Audit isian Form RM: `form-rm.isian.<aksi>`. Metadata TANPA isi form / nama
 * pasien / identitas sementara — hanya kode form, NOPEN, status, dan rev
 * (+ `tambahan` berupa nomor/kode, mis. NOPEN sebelum tautan dilepas).
 */
export const auditIsian = (
  aktor: Aktor,
  aksi: string,
  row: Pick<FormRmIsian, "id" | "formKode" | "nopen" | "status" | "rev">,
  tambahan?: Record<string, string | number>,
) =>
  writeAudit({
    actorId: aktor.id,
    actorName: aktor.nama,
    action: `form-rm.isian.${aksi}`,
    targetId: row.id,
    metadata: { kode: row.formKode, nopen: row.nopen, status: row.status, rev: row.rev, ...tambahan },
    ip: aktor.ip,
  });
