import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { getEnv } from "@/lib/cloudflare/env";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";
import { studentIdFromTrainingToken, trainingCanSubmitIdentity } from "@/lib/guardian-training";

export const dynamic = "force-dynamic";

const allowedTypes:Record<string,string> = {
  "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp",
};

export async function POST(request:Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    const studentId = await studentIdFromTrainingToken(token);
    if (!studentId) return json({error:"สิทธิ์การอบรมหมดอายุ กรุณายืนยันข้อมูลใหม่"},401);
    const file = form.get("selfie");
    if (!(file instanceof File)) return json({error:"กรุณาเลือกภาพถ่ายยืนยันตัวตน"},400);
    const extension = allowedTypes[file.type];
    if (!extension) return json({error:"รองรับภาพ JPG, PNG หรือ WebP เท่านั้น"},400);
    if (file.size < 10_000 || file.size > 5 * 1024 * 1024) return json({error:"ไฟล์ภาพต้องมีขนาด 10KB–5MB"},400);
    const db = await ensureDatabase();
    const assignment = await db.prepare(`SELECT status,selfie_object_key FROM guardian_training_assignments WHERE student_id=?`)
      .bind(studentId).first<{status:string;selfie_object_key:string|null}>();
    if (!assignment || !trainingCanSubmitIdentity(assignment.status)) return json({error:"สถานะนี้ยังไม่สามารถส่งภาพยืนยันตัวตนได้"},409);
    const objectKey = `guardian-training/selfies/${studentId}/${id()}.${extension}`;
    const bytes = await file.arrayBuffer();
    await getEnv().FILES.put(objectKey,bytes,{httpMetadata:{contentType:file.type,cacheControl:"private, no-store"}});
    await db.prepare(`UPDATE guardian_training_assignments SET selfie_object_key=?,updated_at=? WHERE student_id=?`)
      .bind(objectKey,now(),studentId).run();
    if (assignment.selfie_object_key) await getEnv().FILES.delete(assignment.selfie_object_key);
    return json({success:true});
  } catch (error) {
    return apiError(error);
  }
}
