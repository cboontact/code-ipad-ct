import { ensureDatabase } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params, db = await ensureDatabase();
    const area = await db.prepare("SELECT id, name FROM learning_areas WHERE id = ? AND is_active = 1").bind(id).first();
    if (!area) return json({ error: "ไม่พบกลุ่มสาระการเรียนรู้" }, 404);
    const teachers = await db.prepare(`SELECT t.id, t.prefix, t.first_name, t.last_name, t.position, t.academic_rank,
      CASE WHEN r.id IS NULL THEN 'PENDING' ELSE 'COMPLETED' END AS status
      FROM teachers t LEFT JOIN survey_responses r ON r.teacher_id = t.id
      WHERE t.learning_area_id = ? AND t.is_active = 1 ORDER BY t.sort_order, t.first_name, t.last_name`).bind(id).all();
    return json({ area, teachers: teachers.results ?? [] });
  } catch (error) { return apiError(error); }
}
