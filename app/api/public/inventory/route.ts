import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

function quota(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET() {
  try {
    const db = await ensureDatabase();
    const settings = await getSettings(db);
    const totals = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM survey_responses r JOIN teachers t ON t.id=r.teacher_id
        WHERE t.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1) AS teacher_assigned,
      (SELECT COUNT(*) FROM student_survey_responses r JOIN students s ON s.id=r.student_id
        WHERE s.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1
          AND r.approval_status!='REJECTED') AS student_assigned,
      (SELECT COUNT(*) FROM students
        WHERE is_active=1 AND grade_level IN ('มัธยมศึกษาปีที่ 4','มัธยมศึกษาปีที่ 5','มัธยมศึกษาปีที่ 6')) AS upper_total,
      (SELECT COUNT(*) FROM student_survey_responses r JOIN students s ON s.id=r.student_id
        WHERE s.is_active=1
          AND s.grade_level IN ('มัธยมศึกษาปีที่ 4','มัธยมศึกษาปีที่ 5','มัธยมศึกษาปีที่ 6')
          AND r.decision='ACCEPT' AND r.public_locked=1
          AND r.approval_status!='REJECTED') AS upper_assigned`)
      .first<{ teacher_assigned: number; student_assigned: number; upper_total: number; upper_assigned: number }>();

    const teacherCapacity = quota(settings.teacher_ipad_quota, 127);
    const studentCapacity = quota(settings.student_ipad_quota, 1763);
    const teacherAssigned = Number(totals?.teacher_assigned ?? 0);
    const studentAssigned = Number(totals?.student_assigned ?? 0);
    const upperSecondaryTotal = Number(totals?.upper_total ?? 0);
    const upperSecondaryAssigned = Number(totals?.upper_assigned ?? 0);
    const upperSecondaryReserved = Math.max(0, upperSecondaryTotal - upperSecondaryAssigned);
    const studentRemaining = Math.max(0, studentCapacity - studentAssigned);
    const lowerSecondaryCapacity = Math.max(0, studentCapacity - upperSecondaryTotal);
    const lowerSecondaryAssigned = Math.max(0, studentAssigned - upperSecondaryAssigned);
    const lowerSecondaryRemaining = Math.max(0, lowerSecondaryCapacity - lowerSecondaryAssigned);

    return json({
      teacher: {
        capacity: teacherCapacity,
        assigned: teacherAssigned,
        remaining: Math.max(0, teacherCapacity - teacherAssigned),
      },
      student: {
        capacity: studentCapacity,
        assigned: studentAssigned,
        remaining: studentRemaining,
        upperSecondaryTotal,
        upperSecondaryAssigned,
        upperSecondaryReserved,
        upperSecondaryRemaining: upperSecondaryReserved,
        lowerSecondaryCapacity,
        lowerSecondaryAssigned,
        lowerSecondaryRemaining,
        lowerSecondaryAvailable: lowerSecondaryRemaining,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
