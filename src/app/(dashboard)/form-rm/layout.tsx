import { requireModule } from "@/server/rbac/guard";

export default async function FormRmLayout({ children }: { children: React.ReactNode }) {
  await requireModule("form-rm");
  return <>{children}</>;
}
