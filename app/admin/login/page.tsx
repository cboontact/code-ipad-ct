import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin/admin-login";
import { getCurrentAdmin } from "@/lib/auth/admin";
export const metadata={title:"เข้าสู่ระบบผู้ดูแล"};
export const dynamic = "force-dynamic";
export default async function AdminLoginPage(){
  if (await getCurrentAdmin()) redirect("/admin");
  return <AdminLogin/>;
}
