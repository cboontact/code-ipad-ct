import { z } from "zod";
import { ensureDatabase, getSettings, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import {
  assertSameOrigin,
  clientIp,
  enforcePublicRateLimit,
} from "@/lib/security/request";
import { decryptJson } from "@/lib/security/crypto";
import type { StudentPersonalData } from "@/lib/validation/survey";
import {
  createTrainingToken,
  studentIdFromTrainingToken,
  TRAINING_PASS_SCORE,
  TRAINING_VIDEO_COMPLETION_RATIO,
  trainingCanSubmitIdentity,
  trainingCanTakeQuiz,
  youtubeVideoId,
} from "@/lib/guardian-training";
import { createStudentPrintCookie } from "@/lib/security/student-print-session";

export const dynamic = "force-dynamic";

const phonePattern = /^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/;
const lookupSchema = z.object({
  action: z.literal("lookup"),
  studentCode: z.string().trim().min(1).max(30),
  guardianPhone: z.string().trim().regex(phonePattern),
});
const statusSchema = z.object({
  action: z.literal("status"),
  token: z.string().min(20),
});
const progressSchema = z.object({
  action: z.literal("progress"),
  token: z.string().min(20),
  position: z
    .number()
    .min(0)
    .max(60 * 60 * 8),
  duration: z
    .number()
    .min(1)
    .max(60 * 60 * 8),
  playing: z.boolean(),
  ended: z.boolean().optional().default(false),
});
const quizSchema = z.object({
  action: z.literal("quiz"),
  token: z.string().min(20),
  answers: z.record(z.string(), z.boolean()),
});
const restartSchema = z.object({
  action: z.literal("restart"),
  token: z.string().min(20),
});
const identitySchema = z.object({
  action: z.literal("submitIdentity"),
  token: z.string().min(20),
  relationship: z.enum(["บิดา", "มารดา", "ผู้ปกครอง", "ญาติ"]),
  consent: z.literal(true),
});
const actionSchema = z.discriminatedUnion("action", [
  lookupSchema,
  statusSchema,
  progressSchema,
  quizSchema,
  restartSchema,
  identitySchema,
]);

type TrainingRow = {
  student_id: string;
  student_code: string;
  prefix: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  room: string;
  class_number: string | null;
  decision: string;
  public_locked: number;
  approval_status: string | null;
  pii_ciphertext: string | null;
  pii_iv: string | null;
  status: string;
  cycle: number;
  watched_seconds: number;
  video_duration: number;
  last_progress_at: string | null;
  quiz_score: number | null;
  quiz_attempts: number;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  selfie_object_key: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  handover_status: string | null;
};

async function trainingRow(db: D1Database, studentId: string) {
  return db
    .prepare(
      `SELECT s.id AS student_id,s.student_code,s.prefix,s.first_name,s.last_name,
      s.grade_level,s.room,s.class_number,r.decision,r.public_locked,r.approval_status,
      r.pii_ciphertext,r.pii_iv,t.status,t.cycle,t.watched_seconds,t.video_duration,
      t.last_progress_at,t.quiz_score,t.quiz_attempts,t.guardian_name,t.guardian_relationship,
      t.guardian_phone,t.selfie_object_key,t.submitted_at,t.reviewed_at,t.review_note,
      h.status AS handover_status
    FROM guardian_training_assignments t
    JOIN students s ON s.id=t.student_id
    JOIN student_survey_responses r ON r.student_id=s.id
    LEFT JOIN student_device_handovers h ON h.student_id=s.id AND h.status='ACTIVE'
    WHERE t.student_id=? AND s.is_active=1 LIMIT 1`,
    )
    .bind(studentId)
    .first<TrainingRow>();
}

async function questions(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id,statement,sort_order FROM guardian_training_questions
    WHERE is_active=1 ORDER BY sort_order,id`,
    )
    .all();
  return result.results ?? [];
}

async function responseFor(db: D1Database, row: TrainingRow, token: string) {
  const settings = await getSettings(db);
  const questionRows = trainingCanTakeQuiz(row.status)
    ? await questions(db)
    : [];
  return {
    token,
    student: {
      id: row.student_id,
      studentCode: row.student_code,
      name: `${row.prefix}${row.first_name} ${row.last_name}`,
      gradeLevel: row.grade_level,
      room: row.room,
      classNumber: row.class_number ?? "",
    },
    guardianName: row.guardian_name ?? "",
    guardianPhone: row.guardian_phone ?? "",
    relationship: row.guardian_relationship ?? "",
    status: row.status,
    cycle: Number(row.cycle),
    watchedSeconds: Number(row.watched_seconds || 0),
    videoDuration: Number(row.video_duration || 0),
    quizScore: row.quiz_score == null ? null : Number(row.quiz_score),
    quizAttempts: Number(row.quiz_attempts || 0),
    hasSelfie: Boolean(row.selfie_object_key),
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    videoId: youtubeVideoId(
      settings.guardian_training_video_url ?? "https://youtu.be/y02h6XYY-3w",
    ),
    materialUrl: "/api/public/training/material",
    passScore: TRAINING_PASS_SCORE,
    questions: questionRows,
  };
}

async function authenticatedRow(db: D1Database, token: string) {
  const studentId = await studentIdFromTrainingToken(token);
  if (!studentId) return null;
  return trainingRow(db, studentId);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = actionSchema.parse(await request.json());
    const db = await ensureDatabase();

    if (input.action === "lookup") {
      enforcePublicRateLimit(
        `guardian-training:${clientIp(request)}:${input.studentCode}`,
        10,
        900,
      );
      const candidate = await db
        .prepare(
          `SELECT s.id,r.decision,r.public_locked,r.approval_status,
          r.pii_ciphertext,r.pii_iv,t.student_id,x.student_id AS exemption_id,h.status AS handover_status
        FROM students s
        LEFT JOIN student_survey_responses r ON r.student_id=s.id
        LEFT JOIN guardian_training_assignments t ON t.student_id=s.id
        LEFT JOIN guardian_training_exemptions x ON x.student_id=s.id
        LEFT JOIN student_device_handovers h ON h.student_id=s.id AND h.status='ACTIVE'
        WHERE s.student_code=? AND s.is_active=1 LIMIT 1`,
        )
        .bind(input.studentCode)
        .first<{
          id: string;
          decision: string | null;
          public_locked: number | null;
          approval_status: string | null;
          pii_ciphertext: string | null;
          pii_iv: string | null;
          student_id: string | null;
          exemption_id: string | null;
          handover_status: string | null;
        }>();
      if (!candidate)
        return json({ error: "ไม่พบเลขประจำตัวนักเรียนนี้" }, 404);
      if (
        candidate.decision !== "ACCEPT" ||
        candidate.public_locked !== 1 ||
        candidate.approval_status === "REJECTED"
      )
        return json(
          { error: "สถานะการลงทะเบียนของนักเรียนไม่สามารถเข้าอบรมได้" },
          403,
        );
      if (candidate.handover_status === "ACTIVE")
        return json(
          { error: "นักเรียนรับ iPad แล้ว ไม่ต้องเข้าอบรมทดแทน" },
          409,
        );
      if (candidate.exemption_id)
        return json(
          {
            error:
              "นักเรียนได้รับการยกเว้นการอบรมจากโรงเรียนแล้ว สามารถดำเนินการด้านเอกสารต่อได้",
          },
          409,
        );
      if (!candidate.pii_ciphertext || !candidate.pii_iv)
        return json({ error: "ไม่พบข้อมูลผู้ปกครอง กรุณาติดต่อโรงเรียน" }, 409);
      const pii = await decryptJson<StudentPersonalData>(
        candidate.pii_ciphertext,
        candidate.pii_iv,
      );
      if (pii.guardianPhone !== input.guardianPhone)
        return json(
          { error: "เบอร์โทรศัพท์ผู้ปกครองไม่ตรงกับข้อมูลที่ลงทะเบียน" },
          403,
        );
      const guardianName = `${pii.guardianPrefix}${pii.guardianName}`.trim();
      if (!candidate.student_id) {
        const stamp = now();
        await db
          .prepare(
            `INSERT INTO guardian_training_assignments
          (student_id,status,cycle,watched_seconds,video_duration,quiz_attempts,created_at,updated_at)
          VALUES (?,'ASSIGNED',1,0,0,0,?,?) ON CONFLICT(student_id) DO NOTHING`,
          )
          .bind(candidate.id, stamp, stamp)
          .run();
      }
      await db
        .prepare(
          `UPDATE guardian_training_assignments SET guardian_name=?,guardian_phone=?,updated_at=?
        WHERE student_id=?`,
        )
        .bind(guardianName, pii.guardianPhone, now(), candidate.id)
        .run();
      const row = await trainingRow(db, candidate.id);
      if (!row) return json({ error: "ไม่พบรายการอบรม" }, 404);
      const token = await createTrainingToken(candidate.id);
      const headers: Record<string, string> = {};
      if (row.status === "APPROVED")
        headers["Set-Cookie"] = await createStudentPrintCookie(
          candidate.id,
          request,
        );
      return json(await responseFor(db, row, token), 200, headers);
    }

    const row = await authenticatedRow(db, input.token);
    if (!row)
      return json({ error: "สิทธิ์การอบรมหมดอายุ กรุณายืนยันข้อมูลใหม่" }, 401);
    if (row.handover_status === "ACTIVE")
      return json({ error: "นักเรียนรับ iPad แล้ว" }, 409);
    const stamp = now();

    if (input.action === "status")
      return json(await responseFor(db, row, input.token));

    if (input.action === "progress") {
      if (["QUIZ_PASSED", "REVIEW_PENDING", "APPROVED"].includes(row.status))
        return json(await responseFor(db, row, input.token));
      const previous = row.last_progress_at
        ? Date.parse(row.last_progress_at)
        : NaN;
      const elapsed = Number.isFinite(previous)
        ? Math.max(0, Math.min(20, (Date.now() - previous) / 1000))
        : 0;
      const watched = Math.min(
        input.duration,
        Number(row.watched_seconds || 0) + (input.playing ? elapsed : 0),
      );
      const completed =
        watched >= input.duration * TRAINING_VIDEO_COMPLETION_RATIO;
      const status = completed
        ? "VIDEO_COMPLETED"
        : row.status === "ASSIGNED"
          ? "IN_PROGRESS"
          : row.status;
      await db
        .prepare(
          `UPDATE guardian_training_assignments SET status=?,watched_seconds=?,video_duration=?,last_progress_at=?,updated_at=? WHERE student_id=?`,
        )
        .bind(status, watched, input.duration, stamp, stamp, row.student_id)
        .run();
      const updated = await trainingRow(db, row.student_id);
      return json(await responseFor(db, updated!, input.token));
    }

    if (input.action === "restart") {
      if (row.status !== "QUIZ_FAILED")
        return json({ error: "รายการนี้ยังไม่อยู่ในสถานะอบรมใหม่" }, 409);
      await db.batch([
        db
          .prepare(
            `UPDATE guardian_training_assignments SET status='IN_PROGRESS',cycle=cycle+1,watched_seconds=0,video_duration=0,last_progress_at=NULL,quiz_score=NULL,updated_at=? WHERE student_id=?`,
          )
          .bind(stamp, row.student_id),
        db
          .prepare(
            `INSERT INTO guardian_training_events (id,student_id,action,description,created_at) VALUES (?,?, 'RESTART','เริ่มรับชมการอบรมรอบใหม่',?)`,
          )
          .bind(id(), row.student_id, stamp),
      ]);
      const updated = await trainingRow(db, row.student_id);
      return json(await responseFor(db, updated!, input.token));
    }

    if (input.action === "quiz") {
      if (!trainingCanTakeQuiz(row.status))
        return json(
          { error: "กรุณารับชมวิดีโออย่างน้อย 70% ก่อนทำแบบทดสอบ" },
          409,
        );
      const all = await db
        .prepare(
          `SELECT id,correct_answer FROM guardian_training_questions WHERE is_active=1 ORDER BY sort_order,id`,
        )
        .all<{ id: string; correct_answer: number }>();
      const questionRows = all.results ?? [];
      if (
        questionRows.length !== 10 ||
        Object.keys(input.answers).length !== questionRows.length
      )
        return json({ error: "กรุณาตอบคำถามให้ครบทั้ง 10 ข้อ" }, 400);
      if (
        questionRows.some(
          (question) => typeof input.answers[question.id] !== "boolean",
        )
      )
        return json({ error: "กรุณาตอบคำถามให้ครบทั้ง 10 ข้อ" }, 400);
      let score = 0;
      const answerStatements = questionRows.map((question) => {
        const answer = input.answers[question.id];
        const correct = Number(answer) === Number(question.correct_answer);
        if (correct) score += 1;
        return db
          .prepare(
            `INSERT INTO guardian_training_answers (id,student_id,cycle,question_id,answer,is_correct,created_at) VALUES (?,?,?,?,?,?,?)`,
          )
          .bind(
            id(),
            row.student_id,
            row.cycle,
            question.id,
            answer ? 1 : 0,
            correct ? 1 : 0,
            stamp,
          );
      });
      const passed = score === TRAINING_PASS_SCORE;
      await db.batch([
        ...answerStatements,
        db
          .prepare(
            `UPDATE guardian_training_assignments SET status=?,quiz_score=?,quiz_attempts=quiz_attempts+1,updated_at=? WHERE student_id=?`,
          )
          .bind(
            passed ? "QUIZ_PASSED" : "QUIZ_FAILED",
            score,
            stamp,
            row.student_id,
          ),
        db
          .prepare(
            `INSERT INTO guardian_training_events (id,student_id,action,description,created_at) VALUES (?,?,?,?,?)`,
          )
          .bind(
            id(),
            row.student_id,
            passed ? "QUIZ_PASSED" : "QUIZ_FAILED",
            `ทำแบบทดสอบได้ ${score}/10 คะแนน`,
            stamp,
          ),
      ]);
      const updated = await trainingRow(db, row.student_id);
      return json({
        ...(await responseFor(db, updated!, input.token)),
        passed,
        score,
      });
    }

    if (input.action === "submitIdentity") {
      if (!trainingCanSubmitIdentity(row.status))
        return json({ error: "กรุณาผ่านแบบทดสอบก่อนยืนยันตัวตน" }, 409);
      if (!row.selfie_object_key)
        return json({ error: "กรุณาถ่ายภาพยืนยันตัวตนก่อนส่งตรวจ" }, 400);
      await db.batch([
        db
          .prepare(
            `UPDATE guardian_training_assignments SET status='REVIEW_PENDING',guardian_relationship=?,consent_at=?,
          consent_version='PDPA-GUARDIAN-TRAINING-1.0',consent_user_agent=?,submitted_at=?,review_note=NULL,updated_at=? WHERE student_id=?`,
          )
          .bind(
            input.relationship,
            stamp,
            request.headers.get("user-agent")?.slice(0, 500) ?? null,
            stamp,
            stamp,
            row.student_id,
          ),
        db
          .prepare(
            `INSERT INTO guardian_training_events (id,student_id,action,description,created_at) VALUES (?,?, 'SUBMIT','ส่งข้อมูลยืนยันตัวตนให้โรงเรียนตรวจสอบ',?)`,
          )
          .bind(id(), row.student_id, stamp),
      ]);
      const updated = await trainingRow(db, row.student_id);
      return json(await responseFor(db, updated!, input.token));
    }

    return json({ error: "ไม่รองรับรายการนี้" }, 400);
  } catch (error) {
    return apiError(error);
  }
}
