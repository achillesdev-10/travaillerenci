import { redirect } from "next/navigation";
import AdminAppShell from "@/components/admin/AdminAppShell";
import { getAdminSession } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = process.env.ADMIN_EMAIL || "achillesdev10@gmail.com";
  const session = await getAdminSession();

  if (!session) {
    redirect("/achilles/login");
  }

  return <AdminAppShell email={email}>{children}</AdminAppShell>;
}
