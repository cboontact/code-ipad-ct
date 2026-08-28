import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const returnSchema = z.object({
  assignmentId: z.string().min(1),
  holderType: z.enum(["TEACHER", "STUDENT"]),
  returnedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  condition: z.enum(["GOOD", "DAMAGED", "INCOMPLETE", "OTHER"]),
  note: z.string().trim().max(1000).optional().default(""),
});

type Assignment = {
  assignment_id: string;
  holder_id: string;
  holder_name: string;
  holder_code: string | null;
  holder_context: string | null;
  serial_number: string | null;
  asset_number: string | null;
  device_identifier: string | null;
  accessories: string | null;
  assignment_note: string | null;
};

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const db = await ensureDatabase();
    const active = await db.prepare(`SELECT * FROM (
      SELECT 'TEACHER' AS holder_type,d.id AS assignment_id,t.id AS holder_id,
        t.prefix || t.first_name || ' ' || t.last_name AS holder_name,
        t.teacher_code AS holder_code,a.name AS holder_context,d.serial_number,d.asset_number,
        d.device_identifier,d.accessories,d.note AS assignment_note,
        COALESCE(d.assigned_at,d.created_at) AS assigned_at
      FROM device_assignments d
      JOIN teachers t ON t.id=d.teacher_id
      LEFT JOIN learning_areas a ON a.id=t.learning_area_id
      UNION ALL
      SELECT 'STUDENT' AS holder_type,d.id AS assignment_id,s.id AS holder_id,
        s.prefix || s.first_name || ' ' || s.last_name AS holder_name,
        s.student_code AS holder_code,s.grade_level || '/' || s.room AS holder_context,
        d.serial_number,d.asset_number,d.device_identifier,d.accessories,d.note AS assignment_note,
        COALESCE(d.assigned_at,d.created_at) AS assigned_at
      FROM student_device_assignments d
      JOIN students s ON s.id=d.student_id
    ) ORDER BY assigned_at DESC,holder_name`).all();
    const history = await db.prepare(`SELECT h.*,a.display_name AS processed_by_name
      FROM device_return_history h
      LEFT JOIN admin_users a ON a.id=h.processed_by
      ORDER BY h.returned_at DESC,h.created_at DESC LIMIT 1000`).all();
    return json({ active: active.results ?? [], history: history.results ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request);
    const input = returnSchema.parse(await request.json());
    const db = await ensureDatabase();
    const stamp = now();
    const assignment = input.holderType === "TEACHER"
      ? await db.prepare(`SELECT d.id AS assignment_id,t.id AS holder_id,
          t.prefix || t.first_name || ' ' || t.last_name AS holder_name,
          t.teacher_code AS holder_code,a.name AS holder_context,d.serial_number,d.asset_number,
          d.device_identifier,d.accessories,d.note AS assignment_note
        FROM device_assignments d JOIN teachers t ON t.id=d.teacher_id
        LEFT JOIN learning_areas a ON a.id=t.learning_area_id WHERE d.id=?`)
          .bind(input.assignmentId).first<Assignment>()
      : await db.prepare(`SELECT d.id AS assignment_id,s.id AS holder_id,
          s.prefix || s.first_name || ' ' || s.last_name AS holder_name,
          s.student_code AS holder_code,s.grade_level || '/' || s.room AS holder_context,
          d.serial_number,d.asset_number,d.device_identifier,d.accessories,d.note AS assignment_note
        FROM student_device_assignments d JOIN students s ON s.id=d.student_id WHERE d.id=?`)
          .bind(input.assignmentId).first<Assignment>();
    if (!assignment) return json({ error: "ไม่พบรายการจัดสรร หรือเครื่องนี้ถูกรับคืนแล้ว" }, 404);

    const historyId = id();
    const insert = db.prepare(`INSERT INTO device_return_history
      (id,holder_type,holder_id,holder_name,holder_code,holder_context,serial_number,asset_number,
       device_identifier,accessories,assignment_note,returned_at,device_condition,return_note,processed_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        historyId,input.holderType,assignment.holder_id,assignment.holder_name,
        assignment.holder_code,assignment.holder_context,assignment.serial_number,assignment.asset_number,
        assignment.device_identifier,assignment.accessories,assignment.assignment_note,input.returnedAt,
        input.condition,input.note || null,admin.id,stamp,
      );
    const remove = input.holderType === "TEACHER"
      ? db.prepare("DELETE FROM device_assignments WHERE id=?").bind(input.assignmentId)
      : db.prepare("DELETE FROM student_device_assignments WHERE id=?").bind(input.assignmentId);
    await db.batch([insert, remove]);
    await audit(db,admin.id,"RETURN_DEVICE","device_return",historyId,
      `รับคืน iPad จาก${input.holderType === "TEACHER" ? "ครู" : "นักเรียน"} ${assignment.holder_name} Serial Number ${assignment.serial_number || "ไม่ระบุ"}`,
    );
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
