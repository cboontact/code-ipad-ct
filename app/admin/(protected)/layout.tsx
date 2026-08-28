import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/components/admin/admin-shell";
export const dynamic="force-dynamic";
export default async function ProtectedAdminLayout({children}:{children:React.ReactNode}){const admin=await getCurrentAdmin();if(!admin)redirect("/admin/login");return <AdminShell admin={admin}>{children}</AdminShell>}
