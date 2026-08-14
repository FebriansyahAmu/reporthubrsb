import { z } from "zod";
import { AGAMA_VALUES, normalizePhone } from "@/features/master/master.constants";
import { isValidModuleAction } from "@/server/rbac/modules";

/* ------------------------------------------------------------------ helpers */

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, "Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, strip.");

const passwordField = z
  .string()
  .min(8, "Sandi minimal 8 karakter.")
  .max(100, "Sandi terlalu panjang.");

const nameField = z.string().trim().min(2, "Nama minimal 2 karakter.").max(120);

const optText = (max: number) => z.string().trim().max(max).optional().default("");

const nikField = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((v) => v === "" || /^\d{16}$/.test(v), "NIK harus 16 digit.");

const tanggalLahirField = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Format tanggal tidak valid.")
  .refine((v) => {
    if (!v) return true;
    const d = new Date(v + "T00:00:00");
    return !Number.isNaN(d.getTime()) && d <= new Date();
  }, "Tanggal lahir tidak boleh di masa depan.");

const agamaField = z.union([z.enum(AGAMA_VALUES), z.literal("")]).optional().default("");

const phoneField = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform((v, ctx) => {
    const n = normalizePhone(v ?? "");
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Nomor HP/WA tidak valid." });
      return z.NEVER;
    }
    return n;
  });

const profileShape = {
  nik: nikField,
  nip: optText(30),
  gelarDepan: optText(30),
  name: nameField,
  gelarBelakang: optText(40),
  tanggalLahir: tanggalLahirField,
  agama: agamaField,
  phone: phoneField,
};

/* ------------------------------------------------------------------- users */

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
  roleKey: z.string().trim().max(40).optional(),
  status: z.enum(["aktif", "nonaktif"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z
  .object({
    username: usernameField,
    roleKey: z.string().trim().min(1, "Peran wajib dipilih.").max(40),
    password: passwordField,
    mustChangePassword: z.boolean().default(true),
    isActive: z.boolean().default(true),
    ...profileShape,
  })
  .strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    roleKey: z.string().trim().min(1, "Peran wajib dipilih.").max(40),
    isActive: z.boolean(),
    mustChangePassword: z.boolean().optional(),
    ...profileShape,
  })
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    mustChangePassword: z.boolean().default(true),
  })
  .strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* ------------------------------------------------------------------- roles */

export const createRoleSchema = z
  .object({
    key: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{2,40}$/, "Kunci peran 2–40 karakter: huruf kecil, angka, titik, garis bawah, strip."),
    name: z.string().trim().min(2, "Nama peran minimal 2 karakter.").max(80),
    description: optText(255),
  })
  .strict();
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2, "Nama peran minimal 2 karakter.").max(80),
    description: optText(255),
  })
  .strict();
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const setGrantsSchema = z
  .object({
    grants: z
      .array(
        z.object({
          moduleKey: z.string().trim().min(1).max(60),
          action: z.string().trim().min(1).max(20),
        }),
      )
      .max(500)
      .refine(
        (arr) => arr.every((g) => isValidModuleAction(g.moduleKey, g.action)),
        "Terdapat izin (modul/aksi) yang tidak dikenal katalog.",
      ),
  })
  .strict();
export type SetGrantsInput = z.infer<typeof setGrantsSchema>;
