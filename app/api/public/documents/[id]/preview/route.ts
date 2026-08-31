import { ensureDatabase } from "@/lib/db/runtime";
import { getEnv } from "@/lib/cloudflare/env";
import { apiError, json } from "@/lib/http";

const previewWidths = new Set([480, 800, 1200, 1600]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const requestedWidth = Number(
      new URL(request.url).searchParams.get("w") ?? "800",
    );
    if (!previewWidths.has(requestedWidth))
      return json({ error: "ขนาดภาพตัวอย่างไม่ถูกต้อง" }, 400);

    const db = await ensureDatabase();
    const document = await db
      .prepare(
        "SELECT object_key, mime_type FROM project_documents WHERE id = ? AND is_active = 1",
      )
      .bind(id)
      .first<{ object_key: string; mime_type: string }>();
    if (!document || !document.mime_type.startsWith("image/"))
      return json({ error: "ไม่พบรูปประชาสัมพันธ์" }, 404);

    const object = await getEnv().FILES.get(document.object_key);
    if (!object) return json({ error: "ไม่พบไฟล์รูปประชาสัมพันธ์" }, 404);

    const transformed = await getEnv()
      .IMAGES.input(object.body)
      .transform({ width: requestedWidth, fit: "scale-down" })
      .output({ format: "image/webp", quality: 92 });
    const response = await transformed.response();
    const headers = new Headers(response.headers);
    headers.set(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    );
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    return apiError(error);
  }
}
