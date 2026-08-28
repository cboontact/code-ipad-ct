import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { decryptJson } from "@/lib/security/crypto";
import type { PersonalData } from "@/lib/validation/survey";
export interface PrintableTeacher {
  id: string;
  documentNumber: number;
  documentYear: number;
  borrowerName: string;
  teacherCode: string;
  position: string;
  citizenId: string;
  phone: string;
  houseNo: string;
  moo: string;
  soi: string;
  road: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  assetNumber: string;
  serialNumber: string;
  deviceIdentifier: string;
  accessories: string;
  settings: Record<string, string>;
}
export async function getPrintableTeacher(
  teacherId: string,
): Promise<PrintableTeacher | null> {
  const db = await ensureDatabase(),
    settings = await getSettings(db),
    row = await db
      .prepare(
        `SELECT t.id,t.teacher_code,t.prefix,t.first_name,t.last_name,t.position,t.phone,r.decision,r.submitted_at,r.pii_ciphertext,r.pii_iv,
          d.asset_number,d.serial_number,d.device_identifier,d.accessories,
          (SELECT COUNT(*) FROM survey_responses r2
            WHERE r2.decision='ACCEPT'
              AND strftime('%Y',r2.submitted_at)=strftime('%Y',r.submitted_at)
              AND (r2.submitted_at<r.submitted_at OR (r2.submitted_at=r.submitted_at AND r2.id<=r.id))) AS document_number
          FROM teachers t JOIN survey_responses r ON r.teacher_id=t.id
          LEFT JOIN device_assignments d ON d.teacher_id=t.id
          WHERE t.id=? AND r.decision='ACCEPT'`,
      )
      .bind(teacherId)
      .first<{
        id: string;
        teacher_code: string | null;
        prefix: string;
        first_name: string;
        last_name: string;
        position: string | null;
        phone: string | null;
        decision: string;
        submitted_at: string;
        document_number: number;
        pii_ciphertext: string;
        pii_iv: string;
        asset_number: string | null;
        serial_number: string | null;
        device_identifier: string | null;
        accessories: string | null;
      }>();
  if (!row || !row.pii_ciphertext || !row.pii_iv) return null;
  const pii = await decryptJson<PersonalData>(row.pii_ciphertext, row.pii_iv);
  const legacyPhone = (pii as PersonalData & { phone?: string }).phone ?? "";
  return {
    id: row.id,
    documentNumber: row.document_number,
    documentYear: new Date(row.submitted_at).getUTCFullYear() + 543,
    borrowerName: `${row.prefix}${row.first_name} ${row.last_name}`,
    teacherCode: row.teacher_code ?? "",
    position: row.position ?? "",
    ...pii,
    phone: row.phone ?? legacyPhone,
    assetNumber: row.asset_number ?? "",
    serialNumber: row.serial_number ?? "",
    deviceIdentifier: row.device_identifier ?? "",
    accessories: row.accessories ?? "",
    settings,
  };
}
export async function getAcceptedTeacherIds(area?: string): Promise<string[]> {
  const db = await ensureDatabase(),
    result = area
      ? await db
          .prepare(
            "SELECT t.id FROM teachers t JOIN survey_responses r ON r.teacher_id=t.id WHERE r.decision='ACCEPT' AND t.learning_area_id=? ORDER BY r.submitted_at,r.id",
          )
          .bind(area)
          .all<{ id: string }>()
      : await db
          .prepare(
            "SELECT t.id FROM teachers t JOIN survey_responses r ON r.teacher_id=t.id WHERE r.decision='ACCEPT' ORDER BY r.submitted_at,r.id",
          )
          .all<{ id: string }>();
  return (result.results ?? []).map((row: { id: string }) => row.id);
}
