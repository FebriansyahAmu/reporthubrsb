import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { BusinessRuleError, ValidationError } from "@/server/lib/errors";
import { commitImport, previewImport } from "@/server/modules/inventaris/barang.service";
import { parseImportWorkbook } from "@/server/modules/inventaris/barang.excel";

export const runtime = "nodejs";

/**
 * POST /api/inventaris/barang/import — multipart { file, mode: "preview"|"commit" }.
 * `preview` → validasi & cocokkan tanpa menulis; `commit` → simpan baris valid.
 */
export const POST = withPermission("inventaris.barang", "create", async (req: NextRequest, _ctx, user) => {
  const form = await req.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "preview");

  if (!(file instanceof File)) throw new ValidationError({ file: ["Berkas Excel wajib diunggah."] });
  if (file.size === 0) throw new ValidationError({ file: ["Berkas kosong."] });
  if (file.size > 5 * 1024 * 1024) throw new ValidationError({ file: ["Ukuran berkas maksimal 5 MB."] });

  const buf = Buffer.from(await file.arrayBuffer());
  const parsed = await parseImportWorkbook(buf);
  if (parsed.error) throw new BusinessRuleError(parsed.error);
  if (parsed.rows.length === 0) throw new BusinessRuleError("Tidak ada baris data pada berkas.");

  if (mode === "commit") {
    const res = await commitImport(parsed.rows, user);
    return ok({ mode: "commit", ...res });
  }
  const preview = await previewImport(parsed.rows);
  return ok({ mode: "preview", ...preview });
});
