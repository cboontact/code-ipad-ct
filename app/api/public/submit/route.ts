import { ensureDatabase, getSettings, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin, clientIp, enforcePublicRateLimit } from "@/lib/security/request";
import { encryptJson, verifyToken } from "@/lib/security/crypto";
import { surveySubmitSchema } from "@/lib/validation/survey";
import { isValidThaiAddress } from "@/lib/data/thai-address";
import { registrationWindow } from "@/lib/registration-window";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const input = surveySubmitSchema.parse(await request.json()), db = await ensureDatabase();
    enforcePublicRateLimit(`submit:${clientIp(request)}:${input.teacherId}`, 5, 3600);
    const settings = await getSettings(db); if (!registrationWindow(settings, "teacher").isOpen) throw new Error("TEACHER_REGISTRATION_CLOSED");
    const token = await verifyToken<{ teacherId: string; purpose: string }>(input.verificationToken);
    if (!token || token.teacherId !== input.teacherId || token.purpose !== "survey") return json({ error: "การยืนยันหมดอายุ กรุณายืนยันตัวตนใหม่" }, 401);
    const teacher = await db.prepare("SELECT id, prefix, first_name, last_name FROM teachers WHERE id = ? AND is_active = 1").bind(input.teacherId).first<{ id: string; prefix: string; first_name: string; last_name: string }>();
    if (!teacher) return json({ error: "ไม่พบข้อมูลครู" }, 404);
    const configuredQuota = Number.parseInt(settings.teacher_ipad_quota ?? "127", 10);
    const capacity = Number.isFinite(configuredQuota) && configuredQuota >= 0 ? configuredQuota : 127;
    if (input.decision === "ACCEPT" && input.pii && !isValidThaiAddress(input.pii))
      return json({ error: "ข้อมูลจังหวัด อำเภอ ตำบล หรือรหัสไปรษณีย์ไม่ถูกต้อง" }, 400);
    const stamp = now(); let ciphertext: string | null = null, iv: string | null = null;
    if (input.decision === "ACCEPT" && input.pii) ({ ciphertext, iv } = await encryptJson(input.pii));
    const responseWrite = db.prepare(`INSERT INTO survey_responses
        (id,teacher_id,decision,pii_ciphertext,pii_iv,public_locked,privacy_acknowledged_at,submitted_at,updated_at)
      SELECT ?,?,?,?,?,1,?,?,?
      WHERE ?!='ACCEPT' OR (
        SELECT COUNT(*) FROM survey_responses r JOIN teachers t ON t.id=r.teacher_id
        WHERE t.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1
      ) < ?
      ON CONFLICT(teacher_id) DO UPDATE SET
        decision=excluded.decision,
        pii_ciphertext=excluded.pii_ciphertext,
        pii_iv=excluded.pii_iv,
        public_locked=1,
        privacy_acknowledged_at=excluded.privacy_acknowledged_at,
        submitted_at=excluded.submitted_at,
        updated_at=excluded.updated_at
      WHERE survey_responses.public_locked=0
        AND (excluded.decision!='ACCEPT' OR (
          SELECT COUNT(*) FROM survey_responses r JOIN teachers t ON t.id=r.teacher_id
          WHERE t.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1
        ) < ?)`)
      .bind(
        id(), teacher.id, input.decision, ciphertext, iv,
        input.privacyAcknowledged ? stamp : null, stamp, stamp,
        input.decision, capacity, capacity,
      );
    const [, result] = await db.batch([
      db.prepare("UPDATE teachers SET position=?,academic_rank=?,email=?,ndlp_email=?,phone=?,updated_at=? WHERE id=?").bind(input.profile.position,input.profile.academicRank,input.profile.email,input.profile.ndlpEmail,input.profile.phone,stamp,teacher.id),
      responseWrite,
    ]);
    if ((result.meta.changes ?? 0) === 0) {
      const locked = await db.prepare("SELECT public_locked FROM survey_responses WHERE teacher_id=?")
        .bind(teacher.id).first<{ public_locked: number }>();
      return json(
        { error: locked?.public_locked === 1
          ? "ครูท่านนี้บันทึกข้อมูลแล้ว"
          : "iPad สำหรับครูและบุคลากรมีผู้ลงทะเบียนรับครบตามจำนวนแล้ว" },
        409,
      );
    }
    return json({ success: true, teacherName: `${teacher.prefix}${teacher.first_name} ${teacher.last_name}`, submittedAt: stamp });
  } catch (error) { return apiError(error); }
}
