import { z } from "zod";

/** Query dashboard: hanya periode (enum tetap). Rentang tanggal dihitung dari
 *  CURDATE() di SQL — bukan input bebas — jadi tak ada risiko injeksi. */
export const dashboardQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "month"]).default("30d"),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
