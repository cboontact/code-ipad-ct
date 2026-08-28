import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { registrationWindow } from "@/lib/registration-window";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = await ensureDatabase(), settings = await getSettings(db);
    const areas = await db.prepare(`SELECT a.id, a.name, a.icon,
      COUNT(t.id) AS teacher_count, SUM(CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) AS responded_count
      FROM learning_areas a LEFT JOIN teachers t ON t.learning_area_id = a.id AND t.is_active = 1
      LEFT JOIN survey_responses r ON r.teacher_id = t.id
      WHERE a.is_active = 1 GROUP BY a.id ORDER BY a.sort_order, a.name`).all();
    const teacherWindow = registrationWindow(settings, "teacher"),
      lowerStudentWindow = registrationWindow(settings, "student_lower"),
      upperStudentWindow = registrationWindow(settings, "student_upper");
    return json({ settings: {
      systemName: settings.system_name, projectName: settings.project_name, schoolName: settings.school_name,
      organization: settings.organization,
      surveyStatus: teacherWindow.isOpen ? "OPEN" : "CLOSED",
      teacherSurveyStatus: teacherWindow.isOpen ? "OPEN" : "CLOSED",
      studentSurveyStatus: lowerStudentWindow.isOpen || upperStudentWindow.isOpen ? "OPEN" : "CLOSED",
      heroEyebrow: settings.hero_eyebrow,
      heroTitle: settings.hero_title,
      heroProductName: settings.hero_product_name,
      heroProductSuffix: settings.hero_product_suffix,
      heroFreeLabel: settings.hero_free_label,
      heroAudience: settings.hero_audience,
      announcement: settings.announcement,
      surveyEndDate: settings.survey_end_date,
    }, areas: areas.results ?? [] });
  } catch (error) { return apiError(error); }
}
