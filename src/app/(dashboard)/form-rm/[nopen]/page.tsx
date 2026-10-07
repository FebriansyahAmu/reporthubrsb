import { notFound, redirect } from "next/navigation";
import { nopenSchema } from "@/server/modules/form-rm/isian.schema";

export const dynamic = "force-dynamic";

/**
 * Rute lama profil pasien `/form-rm/<nopen>` → `/form-rm/pasien/<nopen>` (PRD
 * §8.4). Sengaja tanpa loading.tsx agar pengalihan berupa status HTTP asli.
 */
export default async function RuteLamaProfil({ params }: { params: Promise<{ nopen: string }> }) {
  const { nopen } = await params;
  if (!nopenSchema.safeParse(nopen).success) notFound();
  redirect(`/form-rm/pasien/${nopen}`);
}
