import { requireModule } from "@/server/rbac/guard";

export default async function KunjunganLayout({ children }: { children: React.ReactNode }) {
  await requireModule("kunjungan");
  return <>{children}</>;
}
