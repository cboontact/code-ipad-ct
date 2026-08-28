import { cookies } from "next/headers";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { hashSecret, sha256, verifySecret } from "@/lib/security/crypto";
import { getEnv } from "@/lib/cloudflare/env";
import { ADMIN_IDLE_SECONDS } from "@/lib/auth/session-policy";

export const ADMIN_COOKIE = "ct_admin_session";
export { ADMIN_IDLE_SECONDS } from "@/lib/auth/session-policy";
const SESSION_COOKIE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_REFRESH_AFTER_SECONDS = 5 * 60;
const DEFAULT_INITIAL_ADMIN_USERNAME = "admin";
const DEFAULT_INITIAL_ADMIN_PASSWORD = "admin123456";

export interface AdminIdentity {
  id: string;
  username: string;
  displayName: string;
  role: "superadmin" | "admin";
}

type AdminSessionRow = {
  session_id: string;
  expires_at: string;
  id: string;
  username: string;
  display_name: string;
  role: "superadmin" | "admin";
};

function nextIdleExpiry() {
  return new Date(Date.now() + ADMIN_IDLE_SECONDS * 1_000).toISOString();
}

export async function bootstrapAdminIfNeeded(
  username: string,
  password: string,
): Promise<void> {
  const db = await ensureDatabase();
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM admin_users")
    .first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;
  const env = getEnv();
  const initialUsername =
    env.ADMIN_INITIAL_USERNAME?.trim() || DEFAULT_INITIAL_ADMIN_USERNAME;
  const initialPassword =
    env.ADMIN_INITIAL_PASSWORD || DEFAULT_INITIAL_ADMIN_PASSWORD;
  if (
    username !== initialUsername ||
    password !== initialPassword
  )
    return;
  const stamp = now();
  await db
    .prepare(
      "INSERT INTO admin_users (id, username, password_hash, display_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 'superadmin', 1, ?, ?)",
    )
    .bind(
      id(),
      username,
      await hashSecret(password),
      env.ADMIN_INITIAL_DISPLAY_NAME ?? "ผู้ดูแลระบบ",
      stamp,
      stamp,
    )
    .run();
}

export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<{ admin: AdminIdentity; token: string } | null> {
  await bootstrapAdminIfNeeded(username, password);
  const db = await ensureDatabase();
  const row = await db
    .prepare(
      "SELECT id, username, display_name, role, password_hash FROM admin_users WHERE username = ? AND is_active = 1",
    )
    .bind(username)
    .first<{
      id: string;
      username: string;
      display_name: string;
      role: "superadmin" | "admin";
      password_hash: string;
    }>();
  if (!row || !(await verifySecret(password, row.password_hash))) return null;
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const stamp = now();
  await db.batch([
    db
      .prepare(
        "INSERT INTO admin_sessions (id, admin_id, session_token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id(), row.id, await sha256(token), nextIdleExpiry(), stamp),
    db
      .prepare(
        "UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(stamp, stamp, row.id),
  ]);
  return {
    admin: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    },
    token,
  };
}

export async function getAdminByToken(
  token?: string | null,
  refreshActivity = false,
): Promise<AdminIdentity | null> {
  if (!token) return null;
  const db = await ensureDatabase();
  const tokenHash = await sha256(token);
  const stamp = now();
  const row = await db
    .prepare(
      "SELECT s.id AS session_id, s.expires_at, a.id, a.username, a.display_name, a.role FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id WHERE s.session_token_hash = ? AND s.expires_at > ? AND a.is_active = 1",
    )
    .bind(tokenHash, stamp)
    .first<AdminSessionRow>();
  if (!row) {
    await db
      .prepare(
        "DELETE FROM admin_sessions WHERE session_token_hash = ? AND expires_at <= ?",
      )
      .bind(tokenHash, stamp)
      .run();
    return null;
  }
  if (
    refreshActivity &&
    new Date(row.expires_at).getTime() - Date.now() <=
      (ADMIN_IDLE_SECONDS - SESSION_REFRESH_AFTER_SECONDS) * 1_000
  ) {
    await db
      .prepare("UPDATE admin_sessions SET expires_at = ? WHERE id = ?")
      .bind(nextIdleExpiry(), row.session_id)
      .run();
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  return getAdminByToken(
    (await cookies()).get(ADMIN_COOKIE)?.value,
    true,
  );
}

export async function requireAdminApi(
  request: Request,
  role?: "superadmin",
): Promise<AdminIdentity> {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  const admin = await getAdminByToken(
    token ? decodeURIComponent(token) : null,
    true,
  );
  if (!admin || (role && admin.role !== role))
    throw new Error(admin ? "FORBIDDEN" : "UNAUTHORIZED");
  return admin;
}

function secureCookieAttribute(request: Request): string {
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const isHttps = forwardedProtocol
    ? forwardedProtocol === "https"
    : new URL(request.url).protocol === "https:";
  return isHttps ? "; Secure" : "";
}

export function sessionCookie(token: string, request: Request): string {
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secureCookieAttribute(request)}; SameSite=Lax; Max-Age=${SESSION_COOKIE_SECONDS}`;
}

export function clearSessionCookie(request: Request): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly${secureCookieAttribute(request)}; SameSite=Lax; Max-Age=0`;
}
