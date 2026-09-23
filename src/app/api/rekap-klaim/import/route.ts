import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { BusinessRuleError, ValidationError } from "@/server/lib/errors";
import { commitImport, parseImportWorkbook, previewImport } from "@/server/modules/rekap-klaim/klaim.import";

export const runtime = "nodejs";

/**
 * POST /api/rekap-klaim/import — multipart { file, mode: "preview"|"commit" }.
 * `preview` → validasi + total per tahun vs baseline (dry-run); `commit` → simpan
 * baris valid + audit "import".
 */
export const POST = withPermission("rekap-klaim.data", "create", async (req: NextRequest, _ctx, user) => {
  const form = await req.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "preview");

  if (!(file instanceof File)) throw new ValidationError({ file: ["Berkas Excel wajib diunggah."] });
  if (file.size === 0) throw new ValidationError({ file: ["Berkas kosong."] });
  if (file.size > 5 * 1024 * 1024) throw new ValidationError({ file: ["Ukuran berkas maksimal 5 MB."] });

  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = await parseImportWorkbook(buf);
  if (parsed.error) throw new BusinessRuleError(parsed.error);
  if (parsed.klaim.length === 0) throw new BusinessRuleError("Tidak ada baris klaim pada berkas.");

  if (mode === "commit") {
    const res = await commitImport(parsed, user);
    return ok({ mode: "commit", ...res });
  }
  const preview = await previewImport(parsed);
  return ok({ mode: "preview", ...preview });
});
