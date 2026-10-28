import { getEnv } from "@/lib/cloudflare/env";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import {
  studentIdFromTrainingToken,
  trainingCanSubmitIdentity,
} from "@/lib/guardian-training";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

const knownExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
};

function headerValue(request: Request, name: string) {
  try {
    return decodeURIComponent(request.headers.get(name) ?? "");
  } catch {
    return "";
  }
}

function imageExtension(contentType: string, filename: string) {
  const known = knownExtensions[contentType];
  if (known) return known;
  const fromName = filename.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const subtype = contentType.slice("image/".length).split("+")[0];
  return /^[a-z0-9]{1,10}$/.test(subtype) ? subtype : "image";
}

export async function uploadTrainingSelfie(request: Request) {
  try {
    assertSameOrigin(request);
    if (request.headers.get("x-pdpa-consent") !== "true")
      return json({ error: "กรุณาอ่านและยอมรับ PDPA ก่อนอัปโหลดภาพ" }, 400);
    const token = headerValue(request, "x-training-token");
    const studentId = await studentIdFromTrainingToken(token);
    if (!studentId)
      return json({ error: "สิทธิ์การอบรมหมดอายุ กรุณายืนยันข้อมูลใหม่" }, 401);
    if (!request.body)
      return json({ error: "กรุณาเลือกภาพถ่ายยืนยันตัวตน" }, 400);

    const filename = headerValue(request, "x-upload-filename");
    const contentType = (request.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/"))
      return json({ error: "กรุณาเลือกไฟล์ภาพ" }, 400);

    const db = await ensureDatabase();
    const assignment = await db
      .prepare(
        `SELECT status,selfie_object_key FROM guardian_training_assignments WHERE student_id=?`,
      )
      .bind(studentId)
      .first<{ status: string; selfie_object_key: string | null }>();
    if (!assignment || !trainingCanSubmitIdentity(assignment.status))
      return json({ error: "สถานะนี้ยังไม่สามารถส่งภาพยืนยันตัวตนได้" }, 409);

    const extension = imageExtension(contentType, filename);
    const objectKey = `guardian-training/selfies/${studentId}/${id()}.${extension}`;
    await getEnv().FILES.put(objectKey, request.body, {
      httpMetadata: { contentType, cacheControl: "private, no-store" },
    });
    const stamp = now();
    await db
      .prepare(
        `UPDATE guardian_training_assignments SET selfie_object_key=?,consent_at=?,
      consent_version='PDPA-GUARDIAN-TRAINING-1.0',consent_user_agent=?,updated_at=? WHERE student_id=?`,
      )
      .bind(
        objectKey,
        stamp,
        request.headers.get("user-agent")?.slice(0, 500) ?? null,
        stamp,
        studentId,
      )
      .run();
    if (assignment.selfie_object_key)
      await getEnv().FILES.delete(assignment.selfie_object_key);
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
