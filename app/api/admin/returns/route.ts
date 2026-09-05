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
  handover_status?: string | null;
  handed_over_at?: string | null;
  recipient_type?: string | null;
  recipient_name?: string | null;
};

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const db = await ensureDatabase();
    const active = await db.prepare(`SELECT * FROM (
      SELECT 'TEACHER' AS holder_type,d.id AS assignment_id,t.id AS holder_id,
        t.prefix || t.first_name || ' ' || t.last_name AS holder_name,
        t.teacher_code AS holder_code,a.name AS holder_context,d.serial_number,d.asset_number,
        d.device_identifier,d.accessories,d.note AS assignment_note,'CONFIRMED' AS pickup_status,
        h.handed_over_at AS assigned_at,
        NULL AS recipient_type,NULL AS recipient_name
      FROM teacher_device_handovers h
      JOIN teachers t ON t.id=h.teacher_id
      JOIN device_assignments d ON d.id=h.assignment_id AND d.teacher_id=h.teacher_id
      LEFT JOIN learning_areas a ON a.id=t.learning_area_id
      WHERE h.status='ACTIVE'
      UNION ALL
      SELECT 'STUDENT' AS holder_type,d.id AS assignment_id,s.id AS holder_id,
        s.prefix || s.first_name || ' ' || s.last_name AS holder_name,
        s.student_code AS holder_code,s.grade_level || '/' || s.room AS holder_context,
        d.serial_number,d.asset_number,d.device_identifier,d.accessories,d.note AS assignment_note,
        'CONFIRMED' AS pickup_status,h.handed_over_at AS assigned_at,
        h.recipient_type,h.recipient_name
      FROM student_device_handovers h
      JOIN students s ON s.id=h.student_id
      JOIN student_device_assignments d ON d.id=h.assignment_id AND d.student_id=h.student_id
      WHERE h.status='ACTIVE'
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
          d.device_identifier,d.accessories,d.note AS assignment_note,
          h.status AS handover_status,h.handed_over_at
        FROM teacher_device_handovers h JOIN teachers t ON t.id=h.teacher_id
        JOIN device_assignments d ON d.id=h.assignment_id AND d.teacher_id=h.teacher_id
        LEFT JOIN learning_areas a ON a.id=t.learning_area_id WHERE d.id=? AND h.status='ACTIVE'`)
          .bind(input.assignmentId).first<Assignment>()
      : await db.prepare(`SELECT d.id AS assignment_id,s.id AS holder_id,
          s.prefix || s.first_name || ' ' || s.last_name AS holder_name,
          s.student_code AS holder_code,s.grade_level || '/' || s.room AS holder_context,
          d.serial_number,d.asset_number,d.device_identifier,d.accessories,d.note AS assignment_note,
          h.status AS handover_status,h.handed_over_at,h.recipient_type,h.recipient_name
        FROM student_device_handovers h
        JOIN students s ON s.id=h.student_id
        JOIN student_device_assignments d ON d.id=h.assignment_id AND d.student_id=h.student_id
        WHERE d.id=? AND h.status='ACTIVE'`)
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
    if (input.holderType === "STUDENT") {
      const handover = db.prepare(`UPDATE student_device_handovers SET status='RETURNED',returned_at=?,returned_by=?,
          return_history_id=?,updated_at=? WHERE student_id=? AND assignment_id=? AND status='ACTIVE'`)
          .bind(input.returnedAt,admin.id,historyId,stamp,assignment.holder_id,input.assignmentId);
      const handoverEvent = db.prepare(`INSERT INTO student_device_handover_events
          (id,student_id,assignment_id,action,recipient_type,recipient_name,serial_number,asset_number,note,processed_by,created_at)
          VALUES (?,?,?,'RETURN',NULL,NULL,?,?,?,?,?)`).bind(
            id(),assignment.holder_id,input.assignmentId,assignment.serial_number,assignment.asset_number,
            input.note || null,admin.id,stamp,
          );
      await db.batch([insert,handover,handoverEvent,remove]);
    } else {
      const handover = db.prepare(`UPDATE teacher_device_handovers SET status='RETURNED',returned_at=?,returned_by=?,
          return_history_id=?,updated_at=? WHERE teacher_id=? AND assignment_id=? AND status='ACTIVE'`)
          .bind(input.returnedAt,admin.id,historyId,stamp,assignment.holder_id,input.assignmentId);
      const handoverEvent = db.prepare(`INSERT INTO teacher_device_handover_events
          (id,teacher_id,assignment_id,action,serial_number,asset_number,note,processed_by,created_at)
          VALUES (?,?,?,'RETURN',?,?,?,?,?)`).bind(id(),assignment.holder_id,input.assignmentId,
            assignment.serial_number,assignment.asset_number,input.note||null,admin.id,stamp);
      await db.batch([insert,handover,handoverEvent,remove]);
    }
    await audit(db,admin.id,"RETURN_DEVICE","device_return",historyId,
      `รับคืน iPad จาก${input.holderType === "TEACHER" ? "ครู" : "นักเรียน"} ${assignment.holder_name} Serial Number ${assignment.serial_number || "ไม่ระบุ"}`,
    );
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
