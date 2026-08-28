import { requireAdminApi } from "@/lib/auth/admin";
import { getEnv } from "@/lib/cloudflare/env";
import { ensureDatabase } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi(request);
    const { id } = await params;
    const db = await ensureDatabase();
    const document = await db
      .prepare(
        "SELECT original_filename, object_key, mime_type FROM project_documents WHERE id = ?",
      )
      .bind(id)
      .first<{
        original_filename: string;
        object_key: string;
        mime_type: string;
      }>();
    if (!document) return json({ error: "ไม่พบไฟล์ประชาสัมพันธ์" }, 404);
    const object = await getEnv().FILES.get(document.object_key);
    if (!object) return json({ error: "ไม่พบไฟล์ในพื้นที่จัดเก็บ" }, 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": document.mime_type,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.original_filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
