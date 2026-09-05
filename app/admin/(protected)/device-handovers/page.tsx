import { DeviceHandovers } from "@/components/admin/device-handovers";
import { getCurrentAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function DeviceHandoversPage() {
  const admin = await getCurrentAdmin();
  return <DeviceHandovers canCancel={admin?.role === "superadmin"}/>;
}
