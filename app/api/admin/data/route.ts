import { requireAdminApi } from "@/lib/auth/admin";
import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { decryptJson } from "@/lib/security/crypto";
import type { PersonalData } from "@/lib/validation/survey";
import { apiError, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const admin = await requireAdminApi(request), db = await ensureDatabase(), url = new URL(request.url), resource = url.searchParams.get("resource") ?? "dashboard";
    if (resource === "dashboard") {
      const teacherTotals = await db.prepare(`SELECT COUNT(t.id) AS total, SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) AS responded,
        SUM(CASE WHEN r.decision = 'ACCEPT' THEN 1 ELSE 0 END) AS accepted, SUM(CASE WHEN r.decision = 'DECLINE' THEN 1 ELSE 0 END) AS declined
        FROM teachers t LEFT JOIN survey_responses r ON r.teacher_id = t.id WHERE t.is_active = 1`).first();
      const studentTotals = await db.prepare(`SELECT COUNT(s.id) AS total, SUM(CASE WHEN r.id IS NOT NULL AND r.public_locked=1 THEN 1 ELSE 0 END) AS responded,
        SUM(CASE WHEN r.decision = 'ACCEPT' AND r.public_locked=1 THEN 1 ELSE 0 END) AS accepted, SUM(CASE WHEN r.decision = 'DECLINE' AND r.public_locked=1 THEN 1 ELSE 0 END) AS declined
        FROM students s LEFT JOIN student_survey_responses r ON r.student_id = s.id WHERE s.is_active = 1`).first<Record<string,number|null>>();
      const teacherNumbers = teacherTotals as Record<string,number|null>;
      const totals = {
        total:Number(teacherNumbers.total??0)+Number(studentTotals?.total??0),
        responded:Number(teacherNumbers.responded??0)+Number(studentTotals?.responded??0),
        accepted:Number(teacherNumbers.accepted??0)+Number(studentTotals?.accepted??0),
        declined:Number(teacherNumbers.declined??0)+Number(studentTotals?.declined??0),
      };
      const areas = await db.prepare(`SELECT a.id, a.name, a.icon, COUNT(t.id) AS total, SUM(CASE WHEN r.decision='ACCEPT' THEN 1 ELSE 0 END) AS accepted,
        SUM(CASE WHEN r.decision='DECLINE' THEN 1 ELSE 0 END) AS declined, SUM(CASE WHEN t.id IS NOT NULL AND r.id IS NULL THEN 1 ELSE 0 END) AS pending
        FROM learning_areas a LEFT JOIN teachers t ON t.learning_area_id=a.id AND t.is_active=1 LEFT JOIN survey_responses r ON r.teacher_id=t.id
        WHERE a.is_active=1 GROUP BY a.id ORDER BY a.sort_order`).all();
      const studentGrades = await db.prepare(`SELECT s.grade_level AS name,COUNT(s.id) AS total,
        SUM(CASE WHEN r.decision='ACCEPT' AND r.public_locked=1 THEN 1 ELSE 0 END) AS accepted,
        SUM(CASE WHEN r.decision='DECLINE' AND r.public_locked=1 THEN 1 ELSE 0 END) AS declined,
        SUM(CASE WHEN r.id IS NULL OR r.public_locked=0 THEN 1 ELSE 0 END) AS pending
        FROM students s LEFT JOIN student_survey_responses r ON r.student_id=s.id
        WHERE s.is_active=1 GROUP BY s.grade_level ORDER BY s.grade_level`).all();
      const teacherAssigned = await db.prepare(`SELECT COUNT(*) AS count FROM survey_responses r JOIN teachers t ON t.id=r.teacher_id WHERE t.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1`).first<{ count: number }>();
      const studentAssigned = await db.prepare(`SELECT COUNT(*) AS count FROM student_survey_responses r JOIN students s ON s.id=r.student_id WHERE s.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1 AND COALESCE(r.approval_status,'PENDING')!='REJECTED'`).first<{ count: number }>();
      const settings = await getSettings(db);
      return json({ totals, teacherTotals, studentTotals, teacherAssigned: teacherAssigned?.count ?? 0, studentAssigned: studentAssigned?.count ?? 0, areas: areas.results ?? [], studentGrades: studentGrades.results ?? [], settings });
    }
    if (resource === "learning-areas") {
      const rows = await db.prepare(`SELECT a.*, COUNT(t.id) AS teacher_count FROM learning_areas a LEFT JOIN teachers t ON t.learning_area_id=a.id GROUP BY a.id ORDER BY a.sort_order, a.name`).all(); return json({ rows: rows.results ?? [] });
    }
    if (resource === "teachers") {
      const rows = await db.prepare(`SELECT t.id,t.teacher_code,t.prefix,t.first_name,t.last_name,t.position,t.academic_rank,t.email,t.ndlp_email,t.phone,t.is_active,t.sort_order,t.learning_area_id,a.name AS learning_area,
        CASE WHEN r.id IS NULL THEN 'PENDING' ELSE r.decision END AS survey_status
        FROM teachers t JOIN learning_areas a ON a.id=t.learning_area_id LEFT JOIN survey_responses r ON r.teacher_id=t.id ORDER BY a.sort_order,t.sort_order,t.first_name`).all();
      const areas = await db.prepare("SELECT id,name FROM learning_areas WHERE is_active=1 ORDER BY sort_order").all(); return json({ rows: rows.results ?? [], areas: areas.results ?? [] });
    }
    if (resource === "results") {
      const rows = await db.prepare(`SELECT t.id,t.prefix,t.first_name,t.last_name,a.name AS learning_area,r.decision,r.submitted_at,r.public_locked,
        d.serial_number FROM teachers t JOIN learning_areas a ON a.id=t.learning_area_id
        LEFT JOIN survey_responses r ON r.teacher_id=t.id LEFT JOIN device_assignments d ON d.teacher_id=t.id ORDER BY r.submitted_at DESC,t.first_name`).all(); return json({ rows: rows.results ?? [] });
    }
    if (resource === "teacher-detail") {
      const teacherId = url.searchParams.get("id"); if (!teacherId) return json({ error: "ไม่พบรหัสครู" }, 400);
      const row = await db.prepare(`SELECT t.*,a.name AS learning_area,r.id AS response_id,r.decision,r.pii_ciphertext,r.pii_iv,r.submitted_at,r.admin_note,
        d.asset_number,d.serial_number,d.device_identifier,d.accessories,d.note AS device_note,d.assigned_at
        FROM teachers t JOIN learning_areas a ON a.id=t.learning_area_id LEFT JOIN survey_responses r ON r.teacher_id=t.id
        LEFT JOIN device_assignments d ON d.teacher_id=t.id WHERE t.id=?`).bind(teacherId).first<Record<string, unknown> & { pii_ciphertext?: string; pii_iv?: string }>();
      if (!row) return json({ error: "ไม่พบข้อมูลครู" }, 404); let pii: PersonalData | null = null;
      if (row.pii_ciphertext && row.pii_iv) pii = await decryptJson<PersonalData>(row.pii_ciphertext, row.pii_iv);
      delete row.pii_ciphertext; delete row.pii_iv; return json({ teacher: row, pii });
    }
    if (resource === "settings") return json({ settings: await getSettings(db) });
    if (resource === "documents") { const rows = await db.prepare("SELECT * FROM project_documents ORDER BY sort_order,created_at DESC,attachment_order").all(); return json({ rows: rows.results ?? [] }); }
    if (resource === "audit") {
      const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
      const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));
      const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
      const filter = query
        ? `WHERE COALESCE(l.action,'') LIKE ? OR COALESCE(l.entity_type,'') LIKE ? OR COALESCE(l.description,'') LIKE ? OR COALESCE(a.display_name,'') LIKE ?`
        : "";
      const like = `%${query}%`;
      const countStatement = db.prepare(`SELECT COUNT(*) AS count FROM audit_logs l LEFT JOIN admin_users a ON a.id=l.admin_id ${filter}`);
      const countRow = query
        ? await countStatement.bind(like, like, like, like).first<{ count: number }>()
        : await countStatement.first<{ count: number }>();
      const total = Number(countRow?.count ?? 0);
      const offset = (page - 1) * pageSize;
      const rowsStatement = db.prepare(`SELECT l.id,l.action,l.entity_type,l.entity_id,l.description,l.created_at,a.display_name
        FROM audit_logs l LEFT JOIN admin_users a ON a.id=l.admin_id ${filter} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`);
      const rows = query
        ? await rowsStatement.bind(like, like, like, like, pageSize, offset).all()
        : await rowsStatement.bind(pageSize, offset).all();
      return json({ rows: rows.results ?? [], total, page, pageSize });
    }
    if (resource === "admin-users") { if (admin.role !== "superadmin") throw new Error("FORBIDDEN"); const rows = await db.prepare("SELECT id,username,display_name,role,is_active,last_login_at,created_at FROM admin_users ORDER BY created_at").all(); return json({ rows: rows.results ?? [] }); }
    return json({ error: "ไม่พบข้อมูลที่ร้องขอ" }, 404);
  } catch (error) { return apiError(error); }
}
