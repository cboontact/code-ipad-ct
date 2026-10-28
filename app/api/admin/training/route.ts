import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";
import { getEnv } from "@/lib/cloudflare/env";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

const assignSchema = z.object({
  action: z.literal("assign"),
  studentIds: z.array(z.string().uuid()).min(1).max(50),
});
const unassignSchema = z.object({
  action: z.literal("unassign"),
  studentIds: z.array(z.string().uuid()).min(1).max(50),
});
const allowQuizSchema = z.object({
  action: z.literal("allowQuiz"),
  studentIds: z.array(z.string().uuid()).min(1).max(50),
});
const exemptSchema = z.object({
  action: z.literal("exempt"),
  studentIds: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().trim().max(500).optional().default(""),
});
const revokeExemptionSchema = z.object({
  action: z.literal("revokeExemption"),
  studentIds: z.array(z.string().uuid()).min(1).max(50),
});
const approveSchema = z.object({
  action: z.literal("approve"),
  studentId: z.string().uuid(),
  note: z.string().trim().max(500).optional().default(""),
});
const rejectSchema = z.object({
  action: z.literal("reject"),
  studentId: z.string().uuid(),
  note: z
    .string()
    .trim()
    .min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร")
    .max(500),
});
const resetSchema = z.object({
  action: z.literal("reset"),
  studentId: z.string().uuid(),
  note: z.string().trim().max(500).optional().default(""),
});
const actionSchema = z.discriminatedUnion("action", [
  assignSchema,
  unassignSchema,
  allowQuizSchema,
  exemptSchema,
  revokeExemptionSchema,
  approveSchema,
  rejectSchema,
  resetSchema,
]);

function positivePage(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const db = await ensureDatabase();
    const url = new URL(request.url),
      page = positivePage(url.searchParams.get("page"));
    const clauses = [
      "s.is_active=1",
      "r.public_locked=1",
      "r.decision='ACCEPT'",
      "COALESCE(r.approval_status,'PENDING')!='REJECTED'",
    ];
    const values: unknown[] = [];
    const search = url.searchParams.get("search")?.trim().toLowerCase(),
      grade = url.searchParams.get("grade")?.trim(),
      room = url.searchParams.get("room")?.trim(),
      status = url.searchParams.get("status")?.trim();
    if (search) {
      clauses.push(
        `(instr(lower(s.student_code),?)>0 OR instr(lower(s.first_name),?)>0 OR instr(lower(s.last_name),?)>0)`,
      );
      values.push(search, search, search);
    }
    if (grade) {
      clauses.push("s.grade_level=?");
      values.push(grade);
    }
    if (room) {
      clauses.push("s.room=?");
      values.push(room);
    }
    if (status === "HANDED_OVER") clauses.push("h.status='ACTIVE'");
    else if (status === "EXEMPT") {
      clauses.push("(h.status IS NULL OR h.status!='ACTIVE')");
      clauses.push("x.student_id IS NOT NULL");
    }
    else if (status === "ASSIGNED")
      clauses.push(
        "(h.status IS NULL OR h.status!='ACTIVE') AND x.student_id IS NULL AND (t.student_id IS NULL OR t.status='ASSIGNED')",
      );
    else if (status) {
      clauses.push("(h.status IS NULL OR h.status!='ACTIVE') AND x.student_id IS NULL AND t.status=?");
      values.push(status);
    }
    const from = `FROM students s JOIN student_survey_responses r ON r.student_id=s.id
      LEFT JOIN guardian_training_assignments t ON t.student_id=s.id
      LEFT JOIN guardian_training_exemptions x ON x.student_id=s.id
      LEFT JOIN student_document_receipts dr ON dr.student_id=s.id AND dr.document_type='AWAT03'
      LEFT JOIN student_device_handovers h ON h.student_id=s.id`;
    const where = `WHERE ${clauses.join(" AND ")}`;
    const [count, rows, options, summary] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) AS count ${from} ${where}`)
        .bind(...values)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT s.id AS student_id,s.student_code,s.prefix,s.first_name,s.last_name,s.grade_level,s.room,s.class_number,
          CASE WHEN h.status='ACTIVE' THEN 'HANDED_OVER'
            WHEN x.student_id IS NOT NULL THEN 'EXEMPT' ELSE COALESCE(t.status,'ASSIGNED') END AS training_status,
          t.cycle,t.watched_seconds,t.video_duration,t.quiz_score,t.quiz_attempts,
          t.guardian_name,t.guardian_relationship,t.guardian_phone,t.selfie_object_key,t.submitted_at,t.reviewed_at,t.review_note,
          x.reason AS exemption_reason,x.exempted_at,
          CASE WHEN dr.status='RECEIVED' THEN 'RECEIVED' ELSE 'PENDING' END AS document_status
        ${from} ${where}
        ORDER BY
          CASE WHEN h.status='ACTIVE' THEN -1
            WHEN x.student_id IS NOT NULL THEN 0
            WHEN t.status='REVIEW_PENDING' THEN 9
            WHEN t.status='APPROVED' THEN 8
            WHEN t.status='QUIZ_PASSED' THEN 7
            WHEN t.status='VIDEO_COMPLETED' THEN 6
            WHEN t.status='IN_PROGRESS' THEN 5
            WHEN t.status IN ('REJECTED','QUIZ_FAILED') THEN 4
            ELSE 1 END DESC,
          CASE WHEN h.status='ACTIVE' AND t.quiz_score IS NOT NULL THEN 2
            WHEN h.status='ACTIVE' AND (COALESCE(t.watched_seconds,0)>0 OR t.guardian_name IS NOT NULL) THEN 1
            ELSE 0 END DESC,
          CASE WHEN x.student_id IS NOT NULL THEN x.updated_at ELSE t.updated_at END DESC,
          s.grade_level,CAST(s.room AS INTEGER),s.room,CAST(s.class_number AS INTEGER),s.first_name,s.last_name
        LIMIT ? OFFSET ?`,
        )
        .bind(...values, PAGE_SIZE, (page - 1) * PAGE_SIZE)
        .all(),
      db
        .prepare(
          `SELECT DISTINCT s.grade_level,s.room FROM students s JOIN student_survey_responses r ON r.student_id=s.id
        WHERE s.is_active=1 AND r.public_locked=1 AND r.decision='ACCEPT' AND COALESCE(r.approval_status,'PENDING')!='REJECTED'
        ORDER BY s.grade_level,CAST(s.room AS INTEGER),s.room`,
        )
        .all(),
      db
        .prepare(
          `SELECT SUM(CASE WHEN h.status IS NULL OR h.status!='ACTIVE' THEN 1 ELSE 0 END) AS eligible,
          SUM(CASE WHEN (h.status IS NULL OR h.status!='ACTIVE') AND x.student_id IS NULL THEN 1 ELSE 0 END) AS assigned,
          SUM(CASE WHEN (h.status IS NULL OR h.status!='ACTIVE') AND x.student_id IS NOT NULL THEN 1 ELSE 0 END) AS exempted,
          SUM(CASE WHEN (h.status IS NULL OR h.status!='ACTIVE') AND t.status='REVIEW_PENDING' THEN 1 ELSE 0 END) AS review_pending,
          SUM(CASE WHEN (h.status IS NULL OR h.status!='ACTIVE') AND t.status='APPROVED' THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN (h.status IS NULL OR h.status!='ACTIVE') AND t.status='QUIZ_FAILED' THEN 1 ELSE 0 END) AS quiz_failed
        ${from} WHERE s.is_active=1 AND r.public_locked=1 AND r.decision='ACCEPT' AND COALESCE(r.approval_status,'PENDING')!='REJECTED'`,
        )
        .first(),
    ]);
    return json({
      rows: rows.results ?? [],
      options: options.results ?? [],
      summary: summary ?? {},
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
    const admin = await requireAdminApi(request);
    const db = await ensureDatabase(),
      stamp = now();
    if (input.action === "exempt") {
      const statements = input.studentIds.map((studentId) =>
        db
          .prepare(
            `INSERT INTO guardian_training_exemptions
        (student_id,reason,exempted_by,exempted_at,updated_at)
        SELECT ?,?,?,?,? WHERE EXISTS (
          SELECT 1 FROM students s JOIN student_survey_responses r ON r.student_id=s.id
          LEFT JOIN student_device_handovers h ON h.student_id=s.id AND h.status='ACTIVE'
          WHERE s.id=? AND s.is_active=1 AND r.public_locked=1 AND r.decision='ACCEPT'
            AND COALESCE(r.approval_status,'PENDING')!='REJECTED' AND h.student_id IS NULL
        ) ON CONFLICT(student_id) DO UPDATE SET reason=excluded.reason,exempted_by=excluded.exempted_by,
          exempted_at=excluded.exempted_at,updated_at=excluded.updated_at`,
          )
          .bind(
            studentId,
            input.reason || null,
            admin.id,
            stamp,
            stamp,
            studentId,
          ),
      );
      await db.batch(statements);
      await audit(
        db,
        admin.id,
        "EXEMPT_GUARDIAN_TRAINING",
        "guardian_training",
        input.studentIds.length === 1 ? input.studentIds[0] : null,
        `ยกเว้นการอบรมผู้ปกครอง ${input.studentIds.length} คน${input.reason ? `: ${input.reason}` : ""}`,
      );
      return json({ success: true });
    }
    if (input.action === "revokeExemption") {
      const placeholders = input.studentIds.map(() => "?").join(",");
      await db
        .prepare(
          `DELETE FROM guardian_training_exemptions WHERE student_id IN (${placeholders})`,
        )
        .bind(...input.studentIds)
        .run();
      await audit(
        db,
        admin.id,
        "REVOKE_GUARDIAN_TRAINING_EXEMPTION",
        "guardian_training",
        input.studentIds.length === 1 ? input.studentIds[0] : null,
        `ยกเลิกการยกเว้นอบรมผู้ปกครอง ${input.studentIds.length} คน`,
      );
      return json({ success: true });
    }
    if (input.action === "assign") {
      const statements = input.studentIds.map((studentId) =>
        db
          .prepare(
            `INSERT INTO guardian_training_assignments
        (student_id,status,cycle,watched_seconds,video_duration,quiz_attempts,assigned_by,created_at,updated_at)
        SELECT ?,'ASSIGNED',1,0,0,0,?,?,? WHERE EXISTS (
          SELECT 1 FROM students s JOIN student_survey_responses r ON r.student_id=s.id
          LEFT JOIN student_device_handovers h ON h.student_id=s.id AND h.status='ACTIVE'
          WHERE s.id=? AND s.is_active=1 AND r.public_locked=1 AND r.decision='ACCEPT'
            AND COALESCE(r.approval_status,'PENDING')!='REJECTED' AND h.student_id IS NULL
        ) ON CONFLICT(student_id) DO NOTHING`,
          )
          .bind(studentId, admin.id, stamp, stamp, studentId),
      );
      await db.batch(statements);
      await audit(
        db,
        admin.id,
        "ASSIGN_GUARDIAN_TRAINING",
        "guardian_training",
        null,
        `กำหนดผู้ต้องอบรมทดแทน ${input.studentIds.length} คน`,
      );
      return json({ success: true });
    }
    if (input.action === "unassign") {
      const stored = await db
        .prepare(
          `SELECT selfie_object_key FROM guardian_training_assignments WHERE status!='APPROVED' AND student_id IN (${input.studentIds.map(() => "?").join(",")})`,
        )
        .bind(...input.studentIds)
        .all<{ selfie_object_key: string | null }>();
      await db.batch([
        ...input.studentIds.map((studentId) =>
          db
            .prepare(
              "DELETE FROM guardian_training_answers WHERE student_id=? AND EXISTS (SELECT 1 FROM guardian_training_assignments WHERE student_id=? AND status!='APPROVED')",
            )
            .bind(studentId, studentId),
        ),
        ...input.studentIds.map((studentId) =>
          db
            .prepare(
              "DELETE FROM guardian_training_assignments WHERE student_id=? AND status!='APPROVED'",
            )
            .bind(studentId),
        ),
      ]);
      await Promise.all(
        (stored.results ?? []).map((row) =>
          row.selfie_object_key
            ? getEnv().FILES.delete(row.selfie_object_key)
            : Promise.resolve(),
        ),
      );
      await audit(
        db,
        admin.id,
        "UNASSIGN_GUARDIAN_TRAINING",
        "guardian_training",
        null,
        `ยกเลิกผู้ต้องอบรมทดแทน ${input.studentIds.length} คน`,
      );
      return json({ success: true });
    }
    if (input.action === "allowQuiz") {
      await db.batch(
        input.studentIds.map((studentId) =>
          db
            .prepare(
              `INSERT INTO guardian_training_assignments
        (student_id,status,cycle,watched_seconds,video_duration,quiz_attempts,assigned_by,created_at,updated_at)
        SELECT ?,'ASSIGNED',1,0,0,0,?,?,? WHERE NOT EXISTS
          (SELECT 1 FROM guardian_training_exemptions WHERE student_id=?)
        ON CONFLICT(student_id) DO NOTHING`,
            )
            .bind(studentId, admin.id, stamp, stamp, studentId),
        ),
      );
      const placeholders = input.studentIds.map(() => "?").join(",");
      const eligible = await db
        .prepare(
          `SELECT student_id,status FROM guardian_training_assignments
        WHERE student_id IN (${placeholders}) AND status IN ('ASSIGNED','IN_PROGRESS','QUIZ_FAILED','VIDEO_COMPLETED')
          AND NOT EXISTS (SELECT 1 FROM guardian_training_exemptions x
            WHERE x.student_id=guardian_training_assignments.student_id)`,
        )
        .bind(...input.studentIds)
        .all<{ student_id: string; status: string }>();
      const candidates = eligible.results ?? [];
      if (!candidates.length)
        return json({ error: "ไม่มีรายการที่สามารถเปิดแบบทดสอบได้" }, 409);
      await db.batch(
        candidates.flatMap((item) => [
          db
            .prepare(
              `UPDATE guardian_training_assignments SET
          status='VIDEO_COMPLETED',
          cycle=CASE WHEN status='QUIZ_FAILED' THEN cycle+1 ELSE cycle END,
          quiz_score=CASE WHEN status='QUIZ_FAILED' THEN NULL ELSE quiz_score END,
          last_progress_at=?,updated_at=?
          WHERE student_id=? AND status IN ('ASSIGNED','IN_PROGRESS','QUIZ_FAILED','VIDEO_COMPLETED')`,
            )
            .bind(stamp, stamp, item.student_id),
          db
            .prepare(
              `INSERT INTO guardian_training_events
          (id,student_id,action,description,processed_by,created_at)
          VALUES (?,?,'ALLOW_QUIZ','ผู้ดูแลอนุญาตให้ข้ามการรับชมวิดีโอและทำแบบทดสอบได้ทันที',?,?)`,
            )
            .bind(id(), item.student_id, admin.id, stamp),
        ]),
      );
      await audit(
        db,
        admin.id,
        "ALLOW_GUARDIAN_TRAINING_QUIZ",
        "guardian_training",
        candidates.length === 1 ? candidates[0].student_id : null,
        `อนุญาตให้ข้ามวิดีโอและทำแบบทดสอบ ${candidates.length} คน`,
      );
      return json({ success: true, updated: candidates.length });
    }
    const assignment = await db
      .prepare(
        "SELECT status,selfie_object_key FROM guardian_training_assignments WHERE student_id=?",
      )
      .bind(input.studentId)
      .first<{ status: string; selfie_object_key: string | null }>();
    if (!assignment) return json({ error: "ไม่พบรายการอบรม" }, 404);
    if (input.action === "approve" || input.action === "reject") {
      if (assignment.status !== "REVIEW_PENDING")
        return json({ error: "รายการนี้ไม่ได้อยู่ระหว่างรอตรวจสอบ" }, 409);
      const status = input.action === "approve" ? "APPROVED" : "REJECTED";
      await db.batch([
        db
          .prepare(
            `UPDATE guardian_training_assignments SET status=?,reviewed_at=?,reviewed_by=?,review_note=?,updated_at=? WHERE student_id=?`,
          )
          .bind(
            status,
            stamp,
            admin.id,
            input.note || null,
            stamp,
            input.studentId,
          ),
        db
          .prepare(
            `INSERT INTO guardian_training_events (id,student_id,action,description,processed_by,created_at) VALUES (?,?,?,?,?,?)`,
          )
          .bind(
            id(),
            input.studentId,
            status,
            input.action === "approve"
              ? "อนุมัติผลการอบรมและยืนยันตัวตน"
              : `ไม่อนุมัติ: ${input.note}`,
            admin.id,
            stamp,
          ),
      ]);
      await audit(
        db,
        admin.id,
        `${status}_GUARDIAN_TRAINING`,
        "guardian_training",
        input.studentId,
        input.action === "approve"
          ? "อนุมัติผลการอบรมผู้ปกครอง"
          : "ไม่อนุมัติผลการอบรมผู้ปกครอง",
      );
      return json({ success: true });
    }
    if (input.action === "reset") {
      await db.batch([
        db
          .prepare(`DELETE FROM guardian_training_answers WHERE student_id=?`)
          .bind(input.studentId),
        db
          .prepare(
            `UPDATE guardian_training_assignments SET status='ASSIGNED',cycle=1,watched_seconds=0,video_duration=0,last_progress_at=NULL,quiz_score=NULL,quiz_attempts=0,selfie_object_key=NULL,consent_at=NULL,submitted_at=NULL,reviewed_at=NULL,reviewed_by=NULL,review_note=?,updated_at=? WHERE student_id=?`,
          )
          .bind(input.note || null, stamp, input.studentId),
        db
          .prepare(
            `INSERT INTO guardian_training_events (id,student_id,action,description,processed_by,created_at) VALUES (?,?, 'RESET',?,?,?)`,
          )
          .bind(
            id(),
            input.studentId,
            input.note || "เปิดให้เริ่มการอบรมใหม่",
            admin.id,
            stamp,
          ),
      ]);
      if (assignment.selfie_object_key)
        await getEnv().FILES.delete(assignment.selfie_object_key);
      await audit(
        db,
        admin.id,
        "RESET_GUARDIAN_TRAINING",
        "guardian_training",
        input.studentId,
        "เปิดให้เริ่มการอบรมใหม่",
      );
      return json({ success: true });
    }
    return json({ error: "ไม่รองรับรายการนี้" }, 400);
  } catch (error) {
    return apiError(error);
  }
}
