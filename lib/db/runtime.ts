import { getEnv } from "@/lib/cloudflare/env";

export const defaultSettings: Record<string, string> = {
  system_name: "ระบบลงทะเบียนรับ iPad สำหรับครูและนักเรียนโรงเรียนจอมทอง",
  project_name:
    "โครงการส่งเสริมการเรียนรู้ขั้นพื้นฐานทุกที่ ทุกเวลา (Anywhere Anytime) สำหรับโรงเรียน",
  school_name: "โรงเรียนจอมทอง",
  subdistrict: "ข่วงเปา",
  district: "จอมทอง",
  province: "เชียงใหม่",
  organization: "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาเชียงใหม่",
  device_brand: "Apple",
  device_model: "iPad A16 WiFi+Cellular 128GB",
  teacher_ipad_quota: "127",
  student_ipad_quota: "1763",
  approver_name: "นางสาววัลภมาภรค์ อาจนาเสียว",
  teacher_approver_name: "นางสาววัลภมาภรค์ อาจนาเสียว",
  student_approver_name: "นางสาววัลภมาภรค์ อาจนาเสียว",
  hero_eyebrow: "Anywhere Anytime",
  hero_title: "ลงทะเบียนรับ",
  hero_product_name: "iPad",
  hero_product_suffix: "ยืมเรียน",
  hero_free_label: "ฟรี!!!",
  hero_audience: "สำหรับครูและนักเรียนโรงเรียนจอมทอง",
  survey_status: "OPEN",
  teacher_registration_opens_at: "",
  teacher_registration_closes_at: "",
  student_registration_opens_at: "",
  student_registration_closes_at: "",
  student_lower_registration_opens_at: "",
  student_lower_registration_closes_at: "",
  student_upper_registration_opens_at: "",
  student_upper_registration_closes_at: "",
  announcement:
    "โปรดเลือกประเภทผู้ใช้งานเพื่อบันทึกความประสงค์รับ iPad",
  survey_end_date: "",
};

export async function ensureDatabase(): Promise<D1Database> {
  const db = getEnv().DB;
  if (!db) throw new Error("ยังไม่ได้กำหนด D1 binding ชื่อ DB");
  // Schema changes run once through D1 migrations. Running CREATE/ALTER/seed
  // statements during a cold start makes hundreds of simultaneous visitors
  // compete for the single D1 write queue.
  return db;
}

let settingsCache: { expiresAt: number; value: Record<string, string> } | null =
  null;

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

export async function getSettings(
  db?: D1Database,
): Promise<Record<string, string>> {
  const current = Date.now();
  if (settingsCache && settingsCache.expiresAt > current)
    return settingsCache.value;
  const database = db ?? (await ensureDatabase());
  const result = await database
    .prepare("SELECT key, value FROM system_settings")
    .all<{ key: string; value: string }>();
  const value = {
    ...defaultSettings,
    ...Object.fromEntries(
      (result.results ?? []).map((row) => [row.key, row.value]),
    ),
  };
  settingsCache = { expiresAt: Date.now() + 5_000, value };
  return value;
}
export function id(): string {
  return crypto.randomUUID();
}
export function generateTeacherCode(): string {
  return `CT-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}
export function now(): string {
  return new Date().toISOString();
}
