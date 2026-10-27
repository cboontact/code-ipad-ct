import { getEnv } from "@/lib/cloudflare/env";
import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await ensureDatabase();
    const settings = await getSettings(db);
    const objectKey = settings.guardian_training_material_key ?? "training/materials/parent-meeting-ipad-2569.pdf";
    const object = await getEnv().FILES.get(objectKey);
    if (!object) return json({error:"ยังไม่ได้อัปโหลดเอกสารประกอบการอบรม"},404);
    return new Response(object.body,{headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":`inline; filename="guardian-training-material.pdf"`,
      "Cache-Control":"public, max-age=3600",
    }});
  } catch (error) {
    return apiError(error);
  }
}
