import { redirect } from "next/navigation";
import { AdminUsersManager } from "@/components/admin/admin-users-manager";
import { getCurrentAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export default async function AdminUsersPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.role !== "superadmin") redirect("/admin");
  return <AdminUsersManager currentAdminId={admin.id} />;
}
