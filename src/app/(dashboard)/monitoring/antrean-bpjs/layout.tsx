import { requireModule } from "@/server/rbac/guard";

export default async function AntreanBpjsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("monitoring.antrean-bpjs");
  return <>{children}</>;
}
