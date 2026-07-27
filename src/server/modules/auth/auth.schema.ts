import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Username wajib diisi")
    .max(191),
  password: z.string().min(1, "Kata sandi wajib diisi").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi").max(200),
    newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter").max(200),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Kata sandi baru harus berbeda dari yang lama",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
