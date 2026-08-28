import { ADMIN_COOKIE, clearSessionCookie } from "@/lib/auth/admin";
import { ensureDatabase, now } from "@/lib/db/runtime";
import { sha256 } from "@/lib/security/crypto";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const db = await ensureDatabase();
    const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
    if (token) await db.prepare("DELETE FROM admin_sessions WHERE session_token_hash = ?").bind(await sha256(decodeURIComponent(token))).run();
    await db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(now()).run();
    return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
  } catch (error) { return apiError(error); }
}
