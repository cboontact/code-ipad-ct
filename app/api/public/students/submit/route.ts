import { ensureDatabase, getSettings, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin, clientIp, enforcePublicRateLimit } from "@/lib/security/request";
import { encryptJson, verifyToken } from "@/lib/security/crypto";
import { isGuardianNameSameAsStudent, studentSubmitSchema } from "@/lib/validation/survey";
import { isValidThaiAddress } from "@/lib/data/thai-address";
import { studentGradeNumber } from "@/lib/data/student-options";
import { registrationWindow } from "@/lib/registration-window";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = studentSubmitSchema.parse(await request.json()), db = await ensureDatabase();
    enforcePublicRateLimit(
      `student-submit:${clientIp(request)}:${input.studentId}`,
      5,
      3600,
    );
    const settings = await getSettings(db);
    const token = await verifyToken<{studentId:string;purpose:string}>(input.verificationToken);
    if (!token || token.studentId !== input.studentId || token.purpose !== "student-survey")
      return json({ error: "การยืนยันหมดอายุ กรุณายืนยันตัวตนใหม่" }, 401);
    const student = await db.prepare("SELECT id,prefix,first_name,last_name,grade_level FROM students WHERE id=? AND is_active=1")
      .bind(input.studentId).first<{id:string;prefix:string;first_name:string;last_name:string;grade_level:string}>();
    if (!student) return json({ error: "ไม่พบข้อมูลนักเรียน" }, 404);
    if (
      input.decision === "ACCEPT"
      && input.pii
      && isGuardianNameSameAsStudent(input.pii.guardianName, `${student.first_name} ${student.last_name}`)
    ) {
      return json({ error: "ชื่อผู้ปกครองต้องไม่เป็นชื่อเดียวกับนักเรียน กรุณาตรวจสอบอีกครั้ง" }, 400);
    }
    const registrationAudience = ["4", "5", "6"].includes(studentGradeNumber(student.grade_level)) ? "student_upper" : "student_lower";
    if (!registrationWindow(settings, registrationAudience).isOpen) throw new Error("STUDENT_REGISTRATION_CLOSED");
    const configuredQuota = Number.parseInt(settings.student_ipad_quota ?? "1763", 10);
    const capacity = Number.isFinite(configuredQuota) && configuredQuota >= 0 ? configuredQuota : 1763;
    const isUpperSecondary = ["4", "5", "6"].includes(
      studentGradeNumber(student.grade_level),
    );
    let reservedForUpper = 0;
    if (input.decision === "ACCEPT" && !isUpperSecondary) {
      const reserve = await db.prepare(`SELECT MAX(0,
          (SELECT COUNT(*) FROM students
            WHERE is_active=1 AND grade_level IN ('มัธยมศึกษาปีที่ 4','มัธยมศึกษาปีที่ 5','มัธยมศึกษาปีที่ 6'))
          -
          (SELECT COUNT(*) FROM student_survey_responses r
            JOIN students s ON s.id=r.student_id
            WHERE s.is_active=1
              AND s.grade_level IN ('มัธยมศึกษาปีที่ 4','มัธยมศึกษาปีที่ 5','มัธยมศึกษาปีที่ 6')
              AND r.decision='ACCEPT' AND r.public_locked=1
              AND r.approval_status!='REJECTED')
        ) AS count`).first<{ count: number }>();
      reservedForUpper = Number(reserve?.count ?? 0);
    }
    if (input.decision === "ACCEPT" && input.pii && !isValidThaiAddress(input.pii))
      return json({ error: "ข้อมูลจังหวัด อำเภอ ตำบล หรือรหัสไปรษณีย์ไม่ถูกต้อง" }, 400);
    const stamp = now();
    let ciphertext: string | null = null, iv: string | null = null;
    if (input.decision === "ACCEPT" && input.pii)
      ({ ciphertext, iv } = await encryptJson(input.pii));
    const studentUpdate = input.decision === "ACCEPT"
      ? db.prepare("UPDATE students SET phone=?,school_email=?,ndlp_email=?,updated_at=? WHERE id=?")
          .bind(input.phone, input.email, input.ndlpEmail, stamp, student.id)
      : db.prepare("UPDATE students SET phone=?,updated_at=? WHERE id=?")
          .bind(input.phone, stamp, student.id);
    const responseWrite = db.prepare(`INSERT INTO student_survey_responses
        (id,student_id,decision,pii_ciphertext,pii_iv,public_locked,privacy_acknowledged_at,
         submitted_at,updated_at,approval_status,approved_at,approved_by,approval_note)
      SELECT ?,?,?,?,?,1,?,?,?,?,NULL,NULL,NULL
      WHERE ?!='ACCEPT' OR (
        (SELECT COUNT(*) FROM student_survey_responses r JOIN students s ON s.id=r.student_id
          WHERE s.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1
            AND r.approval_status!='REJECTED') < ?
        AND (?=1 OR (
          ? - (SELECT COUNT(*) FROM student_survey_responses r JOIN students s ON s.id=r.student_id
            WHERE s.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1
              AND r.approval_status!='REJECTED')
        ) > ?)
      )
      ON CONFLICT(student_id) DO UPDATE SET
        decision=excluded.decision,
        pii_ciphertext=excluded.pii_ciphertext,
        pii_iv=excluded.pii_iv,
        public_locked=1,
        privacy_acknowledged_at=excluded.privacy_acknowledged_at,
        submitted_at=excluded.submitted_at,
        updated_at=excluded.updated_at,
        approval_status=excluded.approval_status,
        approved_at=NULL,
        approved_by=NULL,
        approval_note=NULL
      WHERE student_survey_responses.public_locked=0
        AND (excluded.decision!='ACCEPT' OR (
          (SELECT COUNT(*) FROM student_survey_responses r JOIN students s ON s.id=r.student_id
            WHERE s.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1
              AND r.approval_status!='REJECTED') < ?
          AND (?=1 OR (
            ? - (SELECT COUNT(*) FROM student_survey_responses r JOIN students s ON s.id=r.student_id
              WHERE s.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1
                AND r.approval_status!='REJECTED')
          ) > ?)
        ))`)
      .bind(
        id(), student.id, input.decision, ciphertext, iv,
        input.privacyAcknowledged ? stamp : null, stamp, stamp,
        input.decision === "ACCEPT" ? "PENDING" : "NOT_REQUIRED",
        input.decision, capacity, isUpperSecondary ? 1 : 0, capacity, reservedForUpper,
        capacity, isUpperSecondary ? 1 : 0, capacity, reservedForUpper,
      );
    const [, result] = await db.batch([
      studentUpdate,
      responseWrite,
    ]);
    if ((result.meta.changes ?? 0) === 0) {
      const locked = await db.prepare("SELECT public_locked FROM student_survey_responses WHERE student_id=?")
        .bind(student.id).first<{ public_locked: number }>();
      return json(
        { error: locked?.public_locked === 1
          ? "นักเรียนคนนี้บันทึกข้อมูลแล้ว"
          : !isUpperSecondary && reservedForUpper > 0
            ? `โควตา ม.ต้นเต็มแล้ว ระบบสำรอง iPad ${reservedForUpper.toLocaleString("th-TH")} เครื่องไว้ให้นักเรียน ม.4–ม.6 ที่ยังไม่ได้ลงทะเบียนรับ`
            : "iPad สำหรับนักเรียนมีผู้ลงทะเบียนรับครบตามจำนวนแล้ว" },
        409,
      );
    }
    return json({ success: true, studentName: `${student.prefix}${student.first_name} ${student.last_name}`, submittedAt: stamp, approvalStatus: input.decision === "ACCEPT" ? "PENDING" : "NOT_REQUIRED" });
  } catch (error) {
    return apiError(error);
  }
}
