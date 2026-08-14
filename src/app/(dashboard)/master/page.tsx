import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { hasModule } from "@/server/rbac/guard";

export const dynamic = "force-dynamic";

/** /master → arahkan ke tab pertama yang boleh diakses. */
export default async function MasterIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (await hasModule(user, "master.pengguna")) redirect("/master/pengguna");
  if (await hasModule(user, "master.peran")) redirect("/master/peran");
  redirect("/403");
}
