import { requireModule } from "@/server/rbac/guard";

export default async function PelayananLayout({ children }: { children: React.ReactNode }) {
  await requireModule("monitoring.pelayanan");
  return <>{children}</>;
}
