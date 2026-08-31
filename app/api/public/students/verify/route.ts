import { z } from "zod";
import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin, clientIp, enforcePublicRateLimit } from "@/lib/security/request";
import { signToken } from "@/lib/security/crypto";
import { registrationWindow } from "@/lib/registration-window";
import { studentGradeNumber } from "@/lib/data/student-options";

const schema = z.object({
  studentCode: z.string().trim().min(1).max(30),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json()),
      db = await ensureDatabase();
    enforcePublicRateLimit(
      `student-verify:${clientIp(request)}:${input.studentCode}`,
      10,
      900,
    );
    const settings = await getSettings(db);
    const student = await db.prepare(`SELECT s.id,s.student_code,s.prefix,s.first_name,s.last_name,s.grade_level,s.room,s.class_number,s.phone,s.school_email,s.ndlp_email,
      r.id AS response_id,r.decision,r.public_locked,r.approval_status,r.approved_at,r.approval_note,r.submitted_at
      FROM students s LEFT JOIN student_survey_responses r ON r.student_id=s.id
      WHERE s.student_code=? AND s.is_active=1`)
      .bind(input.studentCode)
      .first<{id:string;student_code:string;prefix:string;first_name:string;last_name:string;grade_level:string;room:string;class_number:string|null;phone:string|null;school_email:string|null;ndlp_email:string|null;response_id:string|null;decision:string|null;public_locked:number|null;approval_status:string|null;approved_at:string|null;approval_note:string|null;submitted_at:string|null}>();
    if (!student) return json({ error: "ไม่พบเลขประจำตัวนักเรียนนี้ กรุณาตรวจสอบอีกครั้งหรือติดต่อผู้ดูแลระบบ" }, 404);
    const publicStudent = {
      id: student.id,
      studentCode: student.student_code,
      name: `${student.prefix}${student.first_name} ${student.last_name}`,
      gradeLevel: student.grade_level,
      room: student.room,
      classNumber: student.class_number ?? "",
      phone: student.phone ?? "",
      email: student.school_email ?? "",
      ndlpEmail: student.ndlp_email ?? "",
    };
    if (student.public_locked)
      return json({
        alreadyRegistered: true,
        student: publicStudent,
        decision: student.decision,
        approvalStatus: student.approval_status ?? (student.decision === "DECLINE" ? "NOT_REQUIRED" : "PENDING"),
        approvedAt: student.approved_at,
        approvalNote: student.approval_note,
        submittedAt: student.submitted_at,
      });
    const audience = ["4", "5", "6"].includes(studentGradeNumber(student.grade_level)) ? "student_upper" : "student_lower";
    if (!registrationWindow(settings, audience).isOpen) throw new Error("STUDENT_REGISTRATION_CLOSED");
    const verificationToken = await signToken({ studentId: student.id, purpose: "student-survey" }, 2 * 60 * 60);
    return json({
      verificationToken,
      reopened: Boolean(student.response_id),
      student: publicStudent,
    });
  } catch (error) {
    return apiError(error);
  }
}
