import "server-only";
import { definisiForm } from "@/features/form-rm/registry";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { auditIsian } from "./isian.audit";
import { konteksLog, type KonteksLog } from "./isian.konteks";
import { nopenSchema } from "./isian.schema";
import { cariIsianBoleh, keDto, tertaut, type BarisIsian } from "./isian.service";
import type { AktorForm, IsianForm } from "./isian.types";

/**
 * Layanan ALIRAN & ISI TERKINI form berlanjut IGD → RI (PRD Berlanjut §8.5,
 * §8.7). Keduanya hanya untuk form berlanjut yang sudah tertaut; kategori tanpa
 * hak lihat → 404 seragam (sama dengan isian yang tak ada); konteks bukan
 * anggota rantai → 422 tanpa membaca episode itu.
 */

const TAK_ADA = "Isian form tidak ditemukan";

/** Isian berlanjut yang boleh dilihat aktor; form lain diperlakukan tidak ada (404). */
async function isianBerlanjut(id: string, aktor: AktorForm): Promise<BarisIsian> {
  const row = await cariIsianBoleh(id, aktor.hak, "view");
  if (!definisiForm(row.formKode)?.berlanjut || !tertaut(row)) throw new NotFoundError(TAK_ADA);
  return row;
}

/** `?konteks=` → NOPEN; format salah → 422 (sama dengan bukan anggota rantai). */
export function konteksQuery(nilai: string | null): string | undefined {
  if (nilai === null) return undefined;
  const r = nopenSchema.safeParse(nilai);
  if (!r.success) throw new ValidationError({ formErrors: [], fieldErrors: { konteks: ["Konteks episode tidak sah"] } });
  return r.data;
}

/** Bahan membuka aliran: rev & status terkini + konteks (unit/ruang dibaca server). */
export async function bukaAliran(
  id: string,
  konteks: string | undefined,
  aktor: AktorForm,
): Promise<{ isian: IsianForm; konteks: KonteksLog }> {
  const row = await isianBerlanjut(id, aktor);
  return { isian: keDto(row), konteks: await konteksLog(row, konteks) };
}

/* ------------------------------------------------------------ isi terkini */

/**
 * Isi terkini dibaca berulang oleh halaman yang terbuka (setiap event
 * `berubah`) → audit dirangkum: paling banyak satu `form-rm.isian.terkini` per
 * (pengguna, isian) per 10 menit. Pembukaan halaman tetap diaudit `lihat`.
 */
const JEDA_AUDIT_MS = 10 * 60_000;
const MAKS_JEJAK = 5000;
const g = globalThis as unknown as { __formRmAuditTerkini?: Map<string, number> };

function perluAudit(userId: string, isianId: string): boolean {
  const jejak = (g.__formRmAuditTerkini ??= new Map());
  const kunci = `${userId}\u0000${isianId}`;
  const kini = Date.now();
  const lalu = jejak.get(kunci);
  if (lalu !== undefined && kini - lalu < JEDA_AUDIT_MS) return false;
  jejak.delete(kunci);
  if (jejak.size >= MAKS_JEJAK) jejak.delete(jejak.keys().next().value as string);
  jejak.set(kunci, kini);
  return true;
}

/**
 * Isi isian terkini untuk rebase klien (§8.6). Hak lihat dicek SETIAP kali —
 * pengguna yang haknya dicabut tak lagi mendapat isi walau aliran lamanya
 * masih hidup. `konteks` (opsional) divalidasi agar klien tahu tautannya dilepas.
 */
export async function isianTerkini(id: string, konteks: string | undefined, aktor: AktorForm): Promise<IsianForm> {
  const row = await isianBerlanjut(id, aktor);
  if (konteks !== undefined) await konteksLog(row, konteks);
  if (perluAudit(aktor.id, id)) await auditIsian(aktor, "terkini", row);
  return keDto(row);
}
