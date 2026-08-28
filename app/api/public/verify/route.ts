import { z } from "zod";
import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin, clientIp, enforcePublicRateLimit } from "@/lib/security/request";
import { signToken } from "@/lib/security/crypto";
import { registrationWindow } from "@/lib/registration-window";

const schema = z.object({ teacherId: z.string().uuid() });
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const input = schema.parse(await request.json()), db = await ensureDatabase();
    enforcePublicRateLimit(`verify:${clientIp(request)}:${input.teacherId}`, 8, 900);
    const settings = await getSettings(db); if (!registrationWindow(settings, "teacher").isOpen) throw new Error("TEACHER_REGISTRATION_CLOSED");
    const teacher = await db.prepare(`SELECT t.id,t.prefix,t.first_name,t.last_name,t.position,t.academic_rank,t.email,t.ndlp_email,t.phone,
      r.id AS response_id,COALESCE(r.public_locked,0) AS public_locked
      FROM teachers t LEFT JOIN survey_responses r ON r.teacher_id=t.id
      WHERE t.id=? AND t.is_active=1`).bind(input.teacherId).first<{ id: string; prefix: string; first_name: string; last_name: string; position: string | null; academic_rank: string | null; email: string | null; ndlp_email: string | null; phone: string | null; response_id: string | null; public_locked: number }>();
    if (!teacher) return json({ error: "ไม่พบข้อมูลครู" }, 404);
    if (teacher.public_locked) return json({ error: "ครูท่านนี้บันทึกข้อมูลแล้ว หากต้องการแก้ไขกรุณาติดต่อผู้ดูแลระบบ" }, 409);
    const verificationToken = await signToken({ teacherId: teacher.id, purpose: "survey" }, 15 * 60);
    return json({ verificationToken, reopened: Boolean(teacher.response_id), teacher: { id: teacher.id, name: `${teacher.prefix}${teacher.first_name} ${teacher.last_name}`, position: teacher.position ?? "", academicRank: teacher.academic_rank ?? "", email: teacher.email ?? "", ndlpEmail: teacher.ndlp_email ?? "", phone: teacher.phone ?? "" } });
  } catch (error) { return apiError(error); }
}
