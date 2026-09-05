import { TeacherDeviceHandovers } from "@/components/admin/teacher-device-handovers";
import { getCurrentAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function TeacherDeviceHandoversPage() {
  const admin = await getCurrentAdmin();
  return <TeacherDeviceHandovers canCancel={admin?.role === "superadmin"}/>;
}
