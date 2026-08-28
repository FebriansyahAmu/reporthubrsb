import { requireModule } from "@/server/rbac/guard";

export default async function DashboardModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("dashboard");
  return <>{children}</>;
}
