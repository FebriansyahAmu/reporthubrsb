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
