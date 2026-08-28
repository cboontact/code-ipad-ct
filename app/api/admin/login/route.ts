import { z } from "zod";
import { authenticateAdmin, sessionCookie } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin, clientIp, enforceRateLimit } from "@/lib/security/request";

const schema = z.object({ username: z.string().trim().min(3).max(80), password: z.string().min(1).max(200) });
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const input = schema.parse(await request.json()), db = await ensureDatabase();
    await enforceRateLimit(db, `admin-login:${clientIp(request)}:${input.username}`, 7, 900);
    const result = await authenticateAdmin(input.username, input.password);
    if (!result) return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
    await audit(db, result.admin.id, "LOGIN", "admin_session", null, "เข้าสู่ระบบผู้ดูแลสำเร็จ");
    return json({ admin: result.admin }, 200, { "Set-Cookie": sessionCookie(result.token, request) });
  } catch (error) { return apiError(error); }
}
