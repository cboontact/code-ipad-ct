import { requireAdminApi } from "@/lib/auth/admin";
import { apiError, json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { return json({ admin: await requireAdminApi(request) }); } catch (error) { return apiError(error); } }
