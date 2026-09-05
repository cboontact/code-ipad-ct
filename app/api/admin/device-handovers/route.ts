import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth/admin";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const DOCUMENT_TYPE = "AWAT03";

const handoverSchema = z.object({
  action: z.literal("handover"),
  studentId: z.string().uuid(),
  recipientType: z.enum(["STUDENT", "GUARDIAN", "OTHER"]).default("STUDENT"),
  recipientName: z.string().trim().max(200).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

const cancelSchema = z.object({
  action: z.literal("cancel"),
  studentId: z.string().uuid(),
  reason: z.string().trim().min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(500),
});

const actionSchema = z.discriminatedUnion("action", [handoverSchema, cancelSchema]);

function pageNumber(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function addStudentFilters(url: URL, clauses: string[], bindings: unknown[]) {
  const grade = url.searchParams.get("grade")?.trim();
  const room = url.searchParams.get("room")?.trim();
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  if (grade) { clauses.push("s.grade_level=?"); bindings.push(grade); }
  if (room) { clauses.push("s.room=?"); bindings.push(room); }
  if (search) {
    clauses.push(`(
      instr(lower(COALESCE(s.student_code,'')),?)>0 OR
      instr(lower(COALESCE(s.prefix,'')),?)>0 OR
      instr(lower(COALESCE(s.first_name,'')),?)>0 OR
      instr(lower(COALESCE(s.last_name,'')),?)>0
    )`);
    bindings.push(search, search, search, search);
  }
}

const baseFromSql = `FROM students s
  JOIN student_survey_responses r ON r.student_id=s.id
  LEFT JOIN student_document_receipts dr
    ON dr.student_id=s.id AND dr.document_type='${DOCUMENT_TYPE}'
  LEFT JOIN student_device_assignments d ON d.student_id=s.id
  LEFT JOIN student_device_handovers h ON h.student_id=s.id
  LEFT JOIN admin_users handover_admin ON handover_admin.id=h.handed_over_by
  LEFT JOIN admin_users return_admin ON return_admin.id=h.returned_by`;

const approvedClauses = [
  "s.is_active=1",
  "r.public_locked=1",
  "r.decision='ACCEPT'",
  "r.approval_status='APPROVED'",
];

const statusSql = `CASE
  WHEN h.status='ACTIVE' THEN 'RECEIVED'
  WHEN h.status='RETURNED' THEN 'RETURNED'
  WHEN dr.status='RECEIVED' THEN 'READY'
  ELSE 'NOT_READY'
END`;

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const db = await ensureDatabase();
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "list";

    if (mode === "lookup") {
      const studentCode = url.searchParams.get("studentCode")?.trim();
      if (!studentCode) return json({ error: "กรุณากรอกเลขประจำตัวนักเรียน" }, 400);
      const student = await db.prepare(`SELECT s.id AS student_id,s.student_code,s.prefix,s.first_name,s.last_name,
          s.grade_level,s.room,s.class_number,r.decision,r.public_locked,r.approval_status,
          CASE WHEN dr.status='RECEIVED' THEN 'RECEIVED' ELSE 'PENDING' END AS document_status,
          d.id AS assignment_id,d.serial_number,d.asset_number,h.status AS handover_record_status,
          ${statusSql} AS handover_status,h.recipient_type,h.recipient_name,h.handed_over_at,
          h.returned_at,h.note,handover_admin.display_name AS handed_over_by_name,
          return_admin.display_name AS returned_by_name
        FROM students s
        LEFT JOIN student_survey_responses r ON r.student_id=s.id
        LEFT JOIN student_document_receipts dr ON dr.student_id=s.id AND dr.document_type=?
        LEFT JOIN student_device_assignments d ON d.student_id=s.id
        LEFT JOIN student_device_handovers h ON h.student_id=s.id
        LEFT JOIN admin_users handover_admin ON handover_admin.id=h.handed_over_by
        LEFT JOIN admin_users return_admin ON return_admin.id=h.returned_by
        WHERE s.student_code=? AND s.is_active=1 LIMIT 1`)
        .bind(DOCUMENT_TYPE, studentCode).first<Record<string, unknown>>();
      if (!student) return json({ error: "ไม่พบเลขประจำตัวนักเรียนนี้" }, 404);
      const registered = student.public_locked === 1 && student.decision === "ACCEPT";
      const approved = student.approval_status === "APPROVED";
      const documentsReady = student.document_status === "RECEIVED";
      const alreadyActive = student.handover_record_status === "ACTIVE";
      const eligibilityReason = !registered
        ? "นักเรียนยังไม่ได้ลงทะเบียนเลือกรับ iPad"
        : !approved
          ? "รายการรับ iPad ของนักเรียนยังไม่ได้รับอนุมัติ"
          : !documentsReady
            ? "ยังไม่ได้ตรวจรับเอกสาร AWAT-03"
            : alreadyActive
              ? "นักเรียนรับเครื่องแล้ว"
              : null;
      return json({ student: { ...student, eligible: !eligibilityReason, eligibilityReason } });
    }

    if (mode === "history") {
      const page = pageNumber(url.searchParams.get("page"));
      const clauses = ["1=1"];
      const bindings: unknown[] = [];
      addStudentFilters(url, clauses, bindings);
      const action = url.searchParams.get("action");
      if (action && ["HANDOVER", "RETURN", "CANCEL"].includes(action)) {
        clauses.push("e.action=?");
        bindings.push(action);
      }
      const where = `WHERE ${clauses.join(" AND ")}`;
      const count = await db.prepare(`SELECT COUNT(*) AS count
        FROM student_device_handover_events e JOIN students s ON s.id=e.student_id ${where}`)
        .bind(...bindings).first<{ count: number }>();
      const result = await db.prepare(`SELECT e.id,e.action,e.recipient_type,e.recipient_name,
          e.serial_number,e.asset_number,e.note,e.created_at,
          s.id AS student_id,s.student_code,s.prefix,s.first_name,s.last_name,
          s.grade_level,s.room,s.class_number,a.display_name AS processed_by_name
        FROM student_device_handover_events e
        JOIN students s ON s.id=e.student_id
        LEFT JOIN admin_users a ON a.id=e.processed_by
        ${where}
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?`).bind(...bindings, PAGE_SIZE, (page - 1) * PAGE_SIZE).all();
      return json({ rows: result.results ?? [], page, pageSize: PAGE_SIZE, total: Number(count?.count ?? 0) });
    }

    const page = pageNumber(url.searchParams.get("page"));
    const baseClauses = [...approvedClauses];
    const baseBindings: unknown[] = [];
    addStudentFilters(url, baseClauses, baseBindings);
    const listClauses = [...baseClauses];
    const listBindings = [...baseBindings];
    const status = url.searchParams.get("status");
    if (status && ["NOT_READY", "READY", "RECEIVED", "RETURNED"].includes(status)) {
      listClauses.push(`${statusSql}=?`);
      listBindings.push(status);
    }

    const [summary, count, rows, options] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS total,
          SUM(CASE WHEN ${statusSql}='NOT_READY' THEN 1 ELSE 0 END) AS not_ready,
          SUM(CASE WHEN ${statusSql}='READY' THEN 1 ELSE 0 END) AS ready,
          SUM(CASE WHEN ${statusSql}='RECEIVED' THEN 1 ELSE 0 END) AS received,
          SUM(CASE WHEN ${statusSql}='RETURNED' THEN 1 ELSE 0 END) AS returned
        ${baseFromSql} WHERE ${baseClauses.join(" AND ")}`)
        .bind(...baseBindings).first<Record<string, number | null>>(),
      db.prepare(`SELECT COUNT(*) AS count ${baseFromSql} WHERE ${listClauses.join(" AND ")}`)
        .bind(...listBindings).first<{ count: number }>(),
      db.prepare(`SELECT s.id AS student_id,s.student_code,s.prefix,s.first_name,s.last_name,
          s.grade_level,s.room,s.class_number,
          CASE WHEN dr.status='RECEIVED' THEN 'RECEIVED' ELSE 'PENDING' END AS document_status,
          d.id AS assignment_id,d.serial_number,d.asset_number,${statusSql} AS handover_status,
          h.recipient_type,h.recipient_name,h.handed_over_at,h.returned_at,h.note,
          handover_admin.display_name AS handed_over_by_name,return_admin.display_name AS returned_by_name
        ${baseFromSql} WHERE ${listClauses.join(" AND ")}
        ORDER BY s.grade_level,CAST(s.room AS INTEGER),s.room,CAST(s.class_number AS INTEGER),s.first_name,s.last_name
        LIMIT ? OFFSET ?`).bind(...listBindings, PAGE_SIZE, (page - 1) * PAGE_SIZE).all(),
      db.prepare(`SELECT DISTINCT s.grade_level,s.room FROM students s
        JOIN student_survey_responses r ON r.student_id=s.id
        WHERE ${approvedClauses.join(" AND ")}
        ORDER BY s.grade_level,CAST(s.room AS INTEGER),s.room`).all(),
    ]);
    return json({
      rows: rows.results ?? [],
      summary: {
        total: Number(summary?.total ?? 0),
        notReady: Number(summary?.not_ready ?? 0),
        ready: Number(summary?.ready ?? 0),
        received: Number(summary?.received ?? 0),
        returned: Number(summary?.returned ?? 0),
      },
      options: options.results ?? [], page, pageSize: PAGE_SIZE, total: Number(count?.count ?? 0),
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = actionSchema.parse(await request.json());
    const admin = await requireAdminApi(request, input.action === "cancel" ? "superadmin" : undefined);
    const db = await ensureDatabase();
    const stamp = now();

    if (input.action === "cancel") {
      const current = await db.prepare(`SELECT h.student_id,h.assignment_id,h.recipient_type,h.recipient_name,
          h.serial_number,h.asset_number,s.student_code
        FROM student_device_handovers h JOIN students s ON s.id=h.student_id
        WHERE h.student_id=? AND h.status='ACTIVE'`).bind(input.studentId).first<Record<string, string | null>>();
      if (!current) return json({ error: "นักเรียนยังไม่มีสถานะรับเครื่อง หรือสถานะถูกเปลี่ยนแล้ว" }, 409);
      const update = await db.prepare(`UPDATE student_device_handovers SET status='CANCELLED',updated_at=?
        WHERE student_id=? AND status='ACTIVE'`).bind(stamp, input.studentId).run();
      if (Number(update.meta.changes ?? 0) === 0) return json({ error: "สถานะถูกเปลี่ยนโดยผู้ดูแลคนอื่นแล้ว" }, 409);
      await db.prepare(`INSERT INTO student_device_handover_events
        (id,student_id,assignment_id,action,recipient_type,recipient_name,serial_number,asset_number,note,processed_by,created_at)
        VALUES (?,?,?,'CANCEL',?,?,?,?,?,?,?)`).bind(
          id(), input.studentId, current.assignment_id, current.recipient_type, current.recipient_name,
          current.serial_number, current.asset_number, input.reason, admin.id, stamp,
        ).run();
      await audit(db, admin.id, "CANCEL_STUDENT_DEVICE_HANDOVER", "student_device_handover", input.studentId,
        `ยกเลิกสถานะรับเครื่อง รหัสนักเรียน ${current.student_code}: ${input.reason}`);
      return json({ success: true, cancelled: 1 });
    }

    if (input.recipientType !== "STUDENT" && input.recipientName.length < 2)
      return json({ error: "กรุณาระบุชื่อผู้ปกครองหรือผู้รับแทน" }, 400);
    const student = await db.prepare(`SELECT s.id,s.student_code,s.prefix,s.first_name,s.last_name,
        d.id AS assignment_id,d.serial_number,d.asset_number,h.status AS handover_status
      FROM students s
      JOIN student_survey_responses r ON r.student_id=s.id
      JOIN student_document_receipts dr ON dr.student_id=s.id AND dr.document_type=? AND dr.status='RECEIVED'
      LEFT JOIN student_device_assignments d ON d.student_id=s.id
      LEFT JOIN student_device_handovers h ON h.student_id=s.id
      WHERE s.id=? AND s.is_active=1 AND r.public_locked=1 AND r.decision='ACCEPT' AND r.approval_status='APPROVED'`)
      .bind(DOCUMENT_TYPE, input.studentId).first<Record<string, string | null>>();
    if (!student) return json({ error: "รับเครื่องได้หลังอนุมัติและตรวจรับเอกสารแล้วเท่านั้น" }, 409);
    if (student.handover_status === "ACTIVE") return json({ error: "นักเรียนรับเครื่องแล้ว" }, 409);

    let assignmentId = student.assignment_id;
    if (!assignmentId) {
      const proposedId = id();
      await db.prepare(`INSERT INTO student_device_assignments
        (id,student_id,asset_number,serial_number,device_identifier,accessories,note,assigned_at,created_at,updated_at)
        VALUES (?,?,NULL,NULL,NULL,NULL,NULL,?,?,?) ON CONFLICT(student_id) DO NOTHING`)
        .bind(proposedId, input.studentId, stamp, stamp, stamp).run();
      const assignment = await db.prepare("SELECT id,serial_number,asset_number FROM student_device_assignments WHERE student_id=?")
        .bind(input.studentId).first<{ id: string; serial_number: string | null; asset_number: string | null }>();
      if (!assignment) return json({ error: "ไม่สามารถสร้างรายการจัดสรรเครื่องได้" }, 409);
      assignmentId = assignment.id;
      student.serial_number = assignment.serial_number;
      student.asset_number = assignment.asset_number;
    }
    await db.prepare("UPDATE student_device_assignments SET assigned_at=?,updated_at=? WHERE id=?")
      .bind(stamp,stamp,assignmentId).run();

    const update = await db.prepare(`INSERT INTO student_device_handovers
      (student_id,assignment_id,status,recipient_type,recipient_name,serial_number,asset_number,handed_over_at,handed_over_by,returned_at,returned_by,return_history_id,note,updated_at)
      VALUES (?,?,'ACTIVE',?,?,?,?,?,?,NULL,NULL,NULL,?,?)
      ON CONFLICT(student_id) DO UPDATE SET assignment_id=excluded.assignment_id,status='ACTIVE',
        recipient_type=excluded.recipient_type,recipient_name=excluded.recipient_name,
        serial_number=excluded.serial_number,asset_number=excluded.asset_number,
        handed_over_at=excluded.handed_over_at,handed_over_by=excluded.handed_over_by,
        returned_at=NULL,returned_by=NULL,return_history_id=NULL,note=excluded.note,updated_at=excluded.updated_at
      WHERE student_device_handovers.status!='ACTIVE'`).bind(
        input.studentId, assignmentId, input.recipientType,
        input.recipientType === "STUDENT" ? null : input.recipientName,
        student.serial_number, student.asset_number, stamp, admin.id, input.note || null, stamp,
      ).run();
    if (Number(update.meta.changes ?? 0) === 0) return json({ error: "นักเรียนรับเครื่องแล้ว หรือมีผู้ดูแลบันทึกพร้อมกัน" }, 409);
    await db.prepare(`INSERT INTO student_device_handover_events
      (id,student_id,assignment_id,action,recipient_type,recipient_name,serial_number,asset_number,note,processed_by,created_at)
      VALUES (?,?,?,'HANDOVER',?,?,?,?,?,?,?)`).bind(
        id(), input.studentId, assignmentId, input.recipientType,
        input.recipientType === "STUDENT" ? null : input.recipientName,
        student.serial_number, student.asset_number, input.note || null, admin.id, stamp,
      ).run();
    await audit(db, admin.id, "STUDENT_DEVICE_HANDOVER", "student_device_handover", input.studentId,
      `บันทึกรับเครื่องของ ${student.prefix}${student.first_name} ${student.last_name} รหัส ${student.student_code}`);
    return json({ success: true, handedOverAt: stamp, handedOverByName: admin.displayName });
  } catch (error) { return apiError(error); }
}
