import { audit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth/admin";
import { getEnv } from "@/lib/cloudflare/env";
import { ensureDatabase, id, invalidateSettingsCache, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const allowedTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function hasValidSignature(bytes: Uint8Array, type: string) {
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    );
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/webp") {
    const label = new TextDecoder().decode(bytes.slice(0, 12));
    return label.startsWith("RIFF") && label.slice(8) === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request),
      form = await request.formData(),
      file = form.get("file");

    if (!(file instanceof File))
      return json({ error: "กรุณาเลือกไฟล์โลโก้" }, 400);
    const extension = allowedTypes[file.type];
    if (!extension)
      return json({ error: "รองรับเฉพาะไฟล์ PNG, JPG และ WebP" }, 400);
    if (file.size > MAX_LOGO_BYTES)
      return json({ error: "ไฟล์โลโก้ต้องมีขนาดไม่เกิน 5 MB" }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(bytes, file.type))
      return json({ error: "ไฟล์รูปภาพไม่ถูกต้อง" }, 400);

    const db = await ensureDatabase(),
      previous = await db
        .prepare("SELECT value FROM system_settings WHERE key = 'logo_object_key'")
        .first<{ value: string }>(),
      objectKey = `branding/school-logo/${id()}.${extension}`,
      stamp = now();

    await getEnv().FILES.put(objectKey, bytes, {
      httpMetadata: { contentType: file.type },
    });
    try {
      await db
        .prepare(
          "INSERT INTO system_settings (key,value,updated_at,updated_by) VALUES ('logo_object_key',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by",
        )
        .bind(objectKey, stamp, admin.id)
        .run();
    } catch (error) {
      await getEnv().FILES.delete(objectKey);
      throw error;
    }

    if (
      previous?.value &&
      previous.value !== objectKey &&
      previous.value.startsWith("branding/school-logo/")
    )
      await getEnv().FILES.delete(previous.value);

    await audit(
      db,
      admin.id,
      "CHANGE_LOGO",
      "system_settings",
      null,
      "เปลี่ยนโลโก้โรงเรียน",
    );
    invalidateSettingsCache();
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
