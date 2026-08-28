import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";
import { normalizeStudentGrade, normalizeStudentRoom, studentGradeOptions, studentRoomOptions } from "@/lib/data/student-options";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  action: z.enum(["save", "delete"]),
  id: z.string().optional(),
  gradeLevel: z.string().optional(),
  room: z.string().optional(),
  teacherId: z.string().optional(),
  teacherIds: z.array(z.string()).max(2).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const db = await ensureDatabase();
    const [assignments, teachers] = await Promise.all([
      db.prepare(`WITH classes AS (
        SELECT grade_level,room FROM students WHERE is_active=1 GROUP BY grade_level,room
        UNION
        SELECT grade_level,room FROM class_advisors
      ), student_counts AS (
        SELECT grade_level,room,COUNT(*) AS student_count FROM students WHERE is_active=1 GROUP BY grade_level,room
      )
      SELECT ca1.id,c.grade_level,c.room,COALESCE(sc.student_count,0) AS student_count,
        ca1.teacher_id AS advisor1_id,
        t1.prefix || t1.first_name || ' ' || t1.last_name AS advisor1_name,
        a1.name AS advisor1_learning_area,
        ca2.teacher_id AS advisor2_id,
        t2.prefix || t2.first_name || ' ' || t2.last_name AS advisor2_name,
        a2.name AS advisor2_learning_area
      FROM classes c
      LEFT JOIN class_advisors ca1 ON ca1.grade_level=c.grade_level AND ca1.room=c.room AND ca1.advisor_order=1
      LEFT JOIN teachers t1 ON t1.id=ca1.teacher_id
      LEFT JOIN learning_areas a1 ON a1.id=t1.learning_area_id
      LEFT JOIN class_advisors ca2 ON ca2.grade_level=c.grade_level AND ca2.room=c.room AND ca2.advisor_order=2
      LEFT JOIN teachers t2 ON t2.id=ca2.teacher_id
      LEFT JOIN learning_areas a2 ON a2.id=t2.learning_area_id
      LEFT JOIN student_counts sc ON sc.grade_level=c.grade_level AND sc.room=c.room
      ORDER BY c.grade_level,CAST(c.room AS INTEGER),c.room`).all(),
      db.prepare(`SELECT t.id,t.teacher_code,t.prefix,t.first_name,t.last_name,a.name AS learning_area
        FROM teachers t JOIN learning_areas a ON a.id=t.learning_area_id
        WHERE t.is_active=1 ORDER BY a.sort_order,t.first_name,t.last_name`).all(),
    ]);
    return json({ assignments: assignments.results ?? [], teachers: teachers.results ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request);
    const input = inputSchema.parse(await request.json());
    const db = await ensureDatabase();
    const stamp = now();
    if (input.action === "delete") {
      const gradeLevel = normalizeStudentGrade(input.gradeLevel);
      const room = normalizeStudentRoom(input.room);
      if (!gradeLevel || !room) return json({ error: "ไม่พบรายการครูที่ปรึกษา" }, 400);
      const current = await db.prepare("SELECT id FROM class_advisors WHERE grade_level=? AND room=? LIMIT 1")
        .bind(gradeLevel,room).first<{id:string}>();
      if (!current) return json({ error: "ไม่พบรายการครูที่ปรึกษา" }, 404);
      await db.prepare("DELETE FROM class_advisors WHERE grade_level=? AND room=?").bind(gradeLevel,room).run();
      await audit(db,admin.id,"DELETE_CLASS_ADVISOR","class_advisor",current.id,
        `ยกเลิกครูที่ปรึกษาประจำ ${gradeLevel}/${room}`);
      return json({ success: true });
    }

    const gradeLevel = normalizeStudentGrade(input.gradeLevel);
    const room = normalizeStudentRoom(input.room);
    const teacherIds = [...new Set((input.teacherIds ?? (input.teacherId ? [input.teacherId] : [])).filter(Boolean))];
    if (!studentGradeOptions.includes(gradeLevel as typeof studentGradeOptions[number]) || !studentRoomOptions.includes(room) || teacherIds.length < 1 || teacherIds.length > 2)
      return json({ error: "กรุณาเลือกชั้น ห้อง และครูที่ปรึกษา 1–2 คน" }, 400);
    const teachers = [];
    for (const teacherId of teacherIds) {
      const teacher = await db.prepare("SELECT id,prefix,first_name,last_name FROM teachers WHERE id=? AND is_active=1")
        .bind(teacherId).first<{id:string;prefix:string;first_name:string;last_name:string}>();
      if (!teacher) return json({ error: "ไม่พบครูที่เลือกหรือบัญชีครูถูกปิดใช้งาน" }, 404);
      teachers.push(teacher);
    }
    const existing = await db.prepare("SELECT id FROM class_advisors WHERE grade_level=? AND room=? LIMIT 1")
      .bind(gradeLevel,room).first<{id:string}>();
    const statements = [db.prepare("DELETE FROM class_advisors WHERE grade_level=? AND room=?").bind(gradeLevel,room)];
    teacherIds.forEach((teacherId,index) => statements.push(db.prepare(`INSERT INTO class_advisors
      (id,grade_level,room,advisor_order,teacher_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(id(),gradeLevel,room,index+1,teacherId,stamp,stamp)));
    await db.batch(statements);
    await audit(db,admin.id,existing?"EDIT_CLASS_ADVISOR":"SAVE_CLASS_ADVISOR","class_advisor",existing?.id??null,
      `กำหนด ${teachers.map(teacher=>`${teacher.prefix}${teacher.first_name} ${teacher.last_name}`).join(" และ ")} เป็นครูที่ปรึกษา ${gradeLevel}/${room}`);
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
