import { ensureDatabase } from "@/lib/db/runtime";
import { getEnv } from "@/lib/cloudflare/env";
import { apiError, json } from "@/lib/http";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, db = await ensureDatabase(); const doc = await db.prepare("SELECT original_filename, object_key, mime_type FROM project_documents WHERE id = ? AND is_active = 1").bind(id).first<{ original_filename: string; object_key: string; mime_type: string }>();
    if (!doc) return json({ error: "ไม่พบเอกสาร" }, 404); const object = await getEnv().FILES.get(doc.object_key); if (!object) return json({ error: "ไม่พบไฟล์เอกสาร" }, 404);
    return new Response(object.body, { headers: { "Content-Type": doc.mime_type, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.original_filename)}`, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
