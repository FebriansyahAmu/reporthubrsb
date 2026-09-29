import { requireModule } from "@/server/rbac/guard";

export default async function BerkasKlaimLayout({ children }: { children: React.ReactNode }) {
  await requireModule("berkas-klaim");
  return <>{children}</>;
}
