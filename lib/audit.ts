import { id, now } from "@/lib/db/runtime";
export async function audit(db: D1Database, adminId: string | null, action: string, entityType: string, entityId: string | null, description: string, before?: unknown, after?: unknown): Promise<void> {
  const safeJson = (value: unknown) => value === undefined ? null : JSON.stringify(value, (key, item) => /password|secret|ciphertext|access_code|citizen|phone/i.test(key) ? "[REDACTED]" : item);
  await db.prepare("INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, description, before_data, after_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id(), adminId, action, entityType, entityId, description, safeJson(before), safeJson(after), now()).run();
}
