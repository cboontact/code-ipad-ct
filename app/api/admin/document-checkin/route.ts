import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth/admin";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const DOCUMENT_TYPE = "AWAT03";

const receiveSchema = z.object({
  action: z.literal("receive"),
  studentIds: z.array(z.string().uuid()).min(1).max(PAGE_SIZE),
  note: z.string().trim().max(500).optional().default(""),
});

const cancelSchema = z.object({
  action: z.literal("cancel"),
  studentId: z.string().uuid(),
  reason: z.string().trim().min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(500),
});

const actionSchema = z.discriminatedUnion("action", [receiveSchema, cancelSchema]);

function pageNumber(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function addStudentFilters(
  url: URL,
  clauses: string[],
  bindings: unknown[],
) {
  const grade = url.searchParams.get("grade")?.trim();
  const room = url.searchParams.get("room")?.trim();
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  if (grade) {
    clauses.push("s.grade_level=?");
    bindings.push(grade);
  }
  if (room) {
    clauses.push("s.room=?");
    bindings.push(room);
  }
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

const eligibleFromSql = `FROM students s
  JOIN student_survey_responses r ON r.student_id=s.id
  LEFT JOIN student_document_receipts dr
    ON dr.student_id=s.id AND dr.document_type='${DOCUMENT_TYPE}'
  LEFT JOIN admin_users receiver ON receiver.id=dr.received_by`;

const eligibleClauses = [
  "s.is_active=1",
  "r.public_locked=1",
  "r.decision='ACCEPT'",
  "COALESCE(r.approval_status,'PENDING')!='REJECTED'",
];

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
          dr.received_at,receiver.display_name AS received_by_name
        FROM students s
        LEFT JOIN student_survey_responses r ON r.student_id=s.id
        LEFT JOIN student_document_receipts dr ON dr.student_id=s.id AND dr.document_type=?
        LEFT JOIN admin_users receiver ON receiver.id=dr.received_by
        WHERE s.student_code=? AND s.is_active=1
        LIMIT 1`).bind(DOCUMENT_TYPE, studentCode).first<Record<string, unknown>>();
      if (!student) return json({ error: "ไม่พบเลขประจำตัวนักเรียนนี้" }, 404);
      const accepted = student.public_locked === 1 && student.decision === "ACCEPT";
      const rejected = student.approval_status === "REJECTED";
      return json({
        student: {
          ...student,
          eligible: accepted && !rejected,
          eligibilityReason: !accepted
            ? "นักเรียนยังไม่ได้ลงทะเบียนเลือกรับ iPad"
            : rejected
              ? "รายการรับ iPad ของนักเรียนไม่ได้รับอนุมัติ"
              : null,
        },
      });
    }

    if (mode === "history") {
      const page = pageNumber(url.searchParams.get("page"));
      const clauses = ["1=1"];
      const bindings: unknown[] = [];
      addStudentFilters(url, clauses, bindings);
      const action = url.searchParams.get("action");
      if (action && ["RECEIVE", "CANCEL"].includes(action)) {
        clauses.push("e.action=?");
        bindings.push(action);
      }
      const where = `WHERE ${clauses.join(" AND ")}`;
      const count = await db.prepare(`SELECT COUNT(*) AS count
        FROM student_document_receipt_events e
        JOIN students s ON s.id=e.student_id ${where}`)
        .bind(...bindings).first<{ count: number }>();
      const result = await db.prepare(`SELECT e.id,e.action,e.note,e.created_at,
          s.id AS student_id,s.student_code,s.prefix,s.first_name,s.last_name,
          s.grade_level,s.room,s.class_number,a.display_name AS processed_by_name
        FROM student_document_receipt_events e
        JOIN students s ON s.id=e.student_id
        LEFT JOIN admin_users a ON a.id=e.processed_by
        ${where}
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?`).bind(...bindings, PAGE_SIZE, (page - 1) * PAGE_SIZE).all();
      return json({
        rows: result.results ?? [],
        page,
        pageSize: PAGE_SIZE,
        total: Number(count?.count ?? 0),
      });
    }

    const page = pageNumber(url.searchParams.get("page"));
    const baseClauses = [...eligibleClauses];
    const baseBindings: unknown[] = [];
    addStudentFilters(url, baseClauses, baseBindings);
    const status = url.searchParams.get("status");
    const listClauses = [...baseClauses];
    const listBindings = [...baseBindings];
    if (status === "RECEIVED") listClauses.push("dr.status='RECEIVED'");
    if (status === "PENDING") listClauses.push("(dr.status IS NULL OR dr.status!='RECEIVED')");

    const [summary, count, rows, options] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS total,
          SUM(CASE WHEN dr.status='RECEIVED' THEN 1 ELSE 0 END) AS received
        ${eligibleFromSql} WHERE ${baseClauses.join(" AND ")}`)
        .bind(...baseBindings).first<{ total: number; received: number | null }>(),
      db.prepare(`SELECT COUNT(*) AS count ${eligibleFromSql}
        WHERE ${listClauses.join(" AND ")}`).bind(...listBindings).first<{ count: number }>(),
      db.prepare(`SELECT s.id AS student_id,s.student_code,s.prefix,s.first_name,s.last_name,
          s.grade_level,s.room,s.class_number,COALESCE(r.approval_status,'PENDING') AS approval_status,
          CASE WHEN dr.status='RECEIVED' THEN 'RECEIVED' ELSE 'PENDING' END AS document_status,
          dr.received_at,receiver.display_name AS received_by_name
        ${eligibleFromSql}
        WHERE ${listClauses.join(" AND ")}
        ORDER BY s.grade_level,CAST(s.room AS INTEGER),s.room,CAST(s.class_number AS INTEGER),s.first_name,s.last_name
        LIMIT ? OFFSET ?`).bind(...listBindings, PAGE_SIZE, (page - 1) * PAGE_SIZE).all(),
      db.prepare(`SELECT DISTINCT s.grade_level,s.room
        FROM students s JOIN student_survey_responses r ON r.student_id=s.id
        WHERE ${eligibleClauses.join(" AND ")}
        ORDER BY s.grade_level,CAST(s.room AS INTEGER),s.room`).all(),
    ]);
    const total = Number(summary?.total ?? 0);
    const received = Number(summary?.received ?? 0);
    return json({
      rows: rows.results ?? [],
      summary: { total, received, pending: Math.max(0, total - received) },
      options: options.results ?? [],
      page,
      pageSize: PAGE_SIZE,
      total: Number(count?.count ?? 0),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = actionSchema.parse(await request.json());
    const admin = await requireAdminApi(request, input.action === "cancel" ? "superadmin" : undefined);
    const db = await ensureDatabase();
    const stamp = now();

    if (input.action === "cancel") {
      const current = await db.prepare(`SELECT dr.student_id,s.student_code
        FROM student_document_receipts dr JOIN students s ON s.id=dr.student_id
        WHERE dr.student_id=? AND dr.document_type=? AND dr.status='RECEIVED'`)
        .bind(input.studentId, DOCUMENT_TYPE).first<{ student_id: string; student_code: string }>();
      if (!current) return json({ error: "รายการนี้ยังไม่มีสถานะรับเอกสาร หรือถูกยกเลิกแล้ว" }, 409);
      const update = await db.prepare(`UPDATE student_document_receipts
        SET status='CANCELLED',updated_at=?
        WHERE student_id=? AND document_type=? AND status='RECEIVED'`)
        .bind(stamp, input.studentId, DOCUMENT_TYPE).run();
      if ((update.meta.changes ?? 0) === 0) return json({ error: "สถานะเอกสารถูกเปลี่ยนโดยผู้ดูแลคนอื่นแล้ว" }, 409);
      await db.prepare(`INSERT INTO student_document_receipt_events
        (id,student_id,document_type,action,note,processed_by,created_at)
        VALUES (?,?,?,?,?,?,?)`).bind(
          id(), input.studentId, DOCUMENT_TYPE, "CANCEL", input.reason, admin.id, stamp,
        ).run();
      await audit(db, admin.id, "CANCEL_STUDENT_DOCUMENT", "student_document_receipt", input.studentId,
        `ยกเลิกการรับเอกสาร AWAT-03 รหัสนักเรียน ${current.student_code}: ${input.reason}`);
      return json({ success: true, cancelled: 1 });
    }

    const studentIds = [...new Set(input.studentIds)];
    const placeholders = studentIds.map(() => "?").join(",");
    const eligible = await db.prepare(`SELECT s.id,s.student_code,
        CASE WHEN dr.status='RECEIVED' THEN 1 ELSE 0 END AS already_received
      ${eligibleFromSql}
      WHERE ${eligibleClauses.join(" AND ")} AND s.id IN (${placeholders})`)
      .bind(...studentIds).all<{ id: string; student_code: string; already_received: number }>();
    if ((eligible.results?.length ?? 0) !== studentIds.length)
      return json({ error: "มีนักเรียนบางรายการที่ไม่อยู่ในกลุ่มลงทะเบียนรับ iPad กรุณาโหลดข้อมูลใหม่" }, 400);

    const pending = (eligible.results ?? []).filter((student) => student.already_received !== 1);
    let receivedStudents: typeof pending = [];
    if (pending.length) {
      const receiptResults = await db.batch(pending.map((student) =>
        db.prepare(`INSERT INTO student_document_receipts
          (student_id,document_type,status,received_at,received_by,updated_at)
          VALUES (?,?,'RECEIVED',?,?,?)
          ON CONFLICT(student_id,document_type) DO UPDATE SET
            status='RECEIVED',received_at=excluded.received_at,
            received_by=excluded.received_by,updated_at=excluded.updated_at
          WHERE student_document_receipts.status!='RECEIVED'`)
          .bind(student.id, DOCUMENT_TYPE, stamp, admin.id, stamp),
      ));
      receivedStudents = pending.filter((_, index) => Number(receiptResults[index]?.meta.changes ?? 0) > 0);
      if (receivedStudents.length) await db.batch(receivedStudents.map((student) =>
        db.prepare(`INSERT INTO student_document_receipt_events
          (id,student_id,document_type,action,note,processed_by,created_at)
          VALUES (?,?,?,'RECEIVE',?,?,?)`).bind(
            id(), student.id, DOCUMENT_TYPE, input.note || null, admin.id, stamp,
          ),
      ));
      if (receivedStudents.length) await audit(db, admin.id, "RECEIVE_STUDENT_DOCUMENT", "student_document_receipt",
        receivedStudents.length === 1 ? receivedStudents[0].id : null,
        receivedStudents.length === 1
          ? `รับเอกสาร AWAT-03 รหัสนักเรียน ${receivedStudents[0].student_code}`
          : `รับเอกสาร AWAT-03 จำนวน ${receivedStudents.length} ราย`);
    }
    return json({
      success: true,
      received: receivedStudents.length,
      alreadyReceived: studentIds.length - receivedStudents.length,
      receivedAt: stamp,
      receivedByName: admin.displayName,
    });
  } catch (error) {
    return apiError(error);
  }
}
