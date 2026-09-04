import { z } from "zod";
import { audit } from "@/lib/audit";
import { ADMIN_COOKIE, requireAdminApi } from "@/lib/auth/admin";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { hashSecret, sha256 } from "@/lib/security/crypto";
import { assertSameOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  username: z.string().trim().min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร").max(50, "ชื่อผู้ใช้ยาวเกินไป").regex(/^[a-zA-Z0-9._-]+$/, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, จุด ขีดกลาง และขีดล่าง"),
  displayName: z.string().trim().min(2, "กรุณากรอกชื่อที่แสดง").max(100),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกินไป"),
  role: z.enum(["superadmin", "admin"]).default("admin"),
}).strict();
const deleteSchema = z.object({ id: z.string().min(1) }).strict();
const updateSchema = z.object({
  id: z.string().min(1),
  username: z.string().trim().min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร").max(50, "ชื่อผู้ใช้ยาวเกินไป").regex(/^[a-zA-Z0-9._-]+$/, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, จุด ขีดกลาง และขีดล่าง"),
  displayName: z.string().trim().min(2, "กรุณากรอกชื่อที่แสดง").max(100),
  password: z.string().max(128, "รหัสผ่านยาวเกินไป").optional().refine((value) => !value || value.length >= 8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  role: z.enum(["superadmin", "admin"]),
}).strict();

function getSessionToken(request: Request) {
  const encoded = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  if (!encoded) return null;
  try { return decodeURIComponent(encoded); } catch { return null; }
}

export async function GET(request: Request) {
  try {
    await requireAdminApi(request, "superadmin");
    const db = await ensureDatabase();
    const rows = await db.prepare(`SELECT id,username,display_name,role,last_login_at,created_at FROM admin_users WHERE is_active=1 ORDER BY CASE role WHEN 'superadmin' THEN 0 ELSE 1 END,created_at`).all();
    return json({ rows: rows.results ?? [] });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const currentAdmin = await requireAdminApi(request, "superadmin");
    const input = createSchema.parse(await request.json());
    const db = await ensureDatabase(), username = input.username.toLowerCase();
    const duplicate = await db.prepare("SELECT id FROM admin_users WHERE lower(username)=? LIMIT 1").bind(username).first();
    if (duplicate) return json({ error: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" }, 409);
    const adminId = id(), stamp = now();
    await db.prepare(`INSERT INTO admin_users (id,username,password_hash,display_name,role,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`)
      .bind(adminId, username, await hashSecret(input.password), input.displayName, input.role, stamp, stamp).run();
    await audit(db, currentAdmin.id, "CREATE_ADMIN", "admin_user", adminId, `เพิ่มผู้ดูแลระบบ ${username}`);
    return json({ success: true, id: adminId }, 201);
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const currentAdmin = await requireAdminApi(request, "superadmin");
    const input = updateSchema.parse(await request.json());
    const db = await ensureDatabase(), username = input.username.toLowerCase();
    const target = await db.prepare("SELECT id,username,display_name,role,is_active FROM admin_users WHERE id=?").bind(input.id).first<{ id: string; username: string; display_name: string; role: "superadmin" | "admin"; is_active: number }>();
    if (!target || target.is_active !== 1) return json({ error: "ไม่พบบัญชีผู้ดูแลนี้" }, 404);
    if (input.id === currentAdmin.id && input.role !== target.role) return json({ error: "ไม่สามารถเปลี่ยนระดับสิทธิ์ของบัญชีที่กำลังใช้งานอยู่" }, 400);
    const duplicate = await db.prepare("SELECT id FROM admin_users WHERE lower(username)=? AND id<>? LIMIT 1").bind(username, input.id).first();
    if (duplicate) return json({ error: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" }, 409);
    if (target.role === "superadmin" && input.role !== "superadmin") {
      const count = await db.prepare("SELECT COUNT(*) AS count FROM admin_users WHERE role='superadmin' AND is_active=1").first<{ count: number }>();
      if (Number(count?.count ?? 0) <= 1) return json({ error: "ต้องมีผู้ดูแลระบบระดับสูงอย่างน้อย 1 บัญชี" }, 400);
    }
    const stamp = now();
    if (input.password) {
      await db.prepare("UPDATE admin_users SET username=?,display_name=?,role=?,password_hash=?,updated_at=? WHERE id=?")
        .bind(username, input.displayName, input.role, await hashSecret(input.password), stamp, input.id).run();
      if (input.id === currentAdmin.id) {
        const currentToken = getSessionToken(request);
        if (currentToken) await db.prepare("DELETE FROM admin_sessions WHERE admin_id=? AND session_token_hash<>?").bind(input.id, await sha256(currentToken)).run();
      } else {
        await db.prepare("DELETE FROM admin_sessions WHERE admin_id=?").bind(input.id).run();
      }
    } else {
      await db.prepare("UPDATE admin_users SET username=?,display_name=?,role=?,updated_at=? WHERE id=?")
        .bind(username, input.displayName, input.role, stamp, input.id).run();
    }
    await audit(db, currentAdmin.id, "UPDATE_ADMIN", "admin_user", input.id, `แก้ไขผู้ดูแลระบบ ${username}`, { username: target.username, displayName: target.display_name, role: target.role }, { username, displayName: input.displayName, role: input.role, passwordChanged: Boolean(input.password) });
    return json({ success: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const currentAdmin = await requireAdminApi(request, "superadmin");
    const input = deleteSchema.parse(await request.json());
    if (input.id === currentAdmin.id) return json({ error: "ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่" }, 400);
    const db = await ensureDatabase();
    const target = await db.prepare("SELECT username,role,is_active FROM admin_users WHERE id=?").bind(input.id).first<{ username: string; role: "superadmin" | "admin"; is_active: number }>();
    if (!target || target.is_active !== 1) return json({ error: "ไม่พบบัญชีผู้ดูแลนี้" }, 404);
    if (target.role === "superadmin") {
      const count = await db.prepare("SELECT COUNT(*) AS count FROM admin_users WHERE role='superadmin' AND is_active=1").first<{ count: number }>();
      if (Number(count?.count ?? 0) <= 1) return json({ error: "ต้องมีผู้ดูแลระบบระดับสูงอย่างน้อย 1 บัญชี" }, 400);
    }
    const stamp = now();
    await db.batch([
      db.prepare("UPDATE admin_users SET is_active=0,updated_at=? WHERE id=?").bind(stamp, input.id),
      db.prepare("DELETE FROM admin_sessions WHERE admin_id=?").bind(input.id),
    ]);
    await audit(db, currentAdmin.id, "DELETE_ADMIN", "admin_user", input.id, `ลบผู้ดูแลระบบ ${target.username}`);
    return json({ success: true });
  } catch (error) { return apiError(error); }
}
