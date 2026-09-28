import "server-only";
import { getAppDb } from "@/server/db/app.client";

export type AuditInput = {
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  targetId?: string | null;
  /** Metadata ringkas — TANPA PII penuh / sandi. */
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
};

/**
 * Tulis jejak audit ke DB aplikasi (audit_log). Default best-effort: kegagalan
 * audit TIDAK menggagalkan aksi utama (hanya di-log). `strict` = fail-closed —
 * error dilempar ulang agar aksi (mis. ekspor data pasien) tidak diserahkan
 * tanpa jejak. Dipanggil dari service.
 */
export async function writeAudit(input: AuditInput, opts?: { strict?: boolean }): Promise<void> {
  try {
    await getAppDb().auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? undefined) as unknown as object,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[AUDIT] gagal menulis audit:", input.action, err);
    if (opts?.strict) throw err;
  }
}
