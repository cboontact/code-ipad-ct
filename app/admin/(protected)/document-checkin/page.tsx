import { DocumentCheckin } from "@/components/admin/document-checkin";
import { getCurrentAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function DocumentCheckinPage() {
  const admin = await getCurrentAdmin();
  return <DocumentCheckin canCancel={admin?.role === "superadmin"}/>;
}
