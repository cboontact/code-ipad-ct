import { ensureDatabase, getSettings } from "@/lib/db/runtime";
import { decryptJson } from "@/lib/security/crypto";
import type { StudentPersonalData } from "@/lib/validation/survey";

export interface PrintableStudent {
  id: string;
  documentNumber: number;
  documentYear: number;
  borrowerName: string;
  studentCode: string;
  gradeLevel: string;
  room: string;
  advisorName: string;
  citizenId: string;
  phone: string;
  guardianPrefix: string;
  guardianName: string;
  guardianPhone: string;
  houseNo: string;
  moo: string;
  soi: string;
  road: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  serialNumber: string;
  settings: Record<string, string>;
}

export async function getPrintableStudent(studentId: string): Promise<PrintableStudent | null> {
  const db = await ensureDatabase();
  const settings = await getSettings(db);
  const row = await db.prepare(`SELECT s.id,s.student_code,s.prefix,s.first_name,s.last_name,s.grade_level,s.room,s.phone,
    r.id AS response_id,r.submitted_at,r.pii_ciphertext,r.pii_iv,d.serial_number,
    advisor1.prefix || advisor1.first_name || ' ' || advisor1.last_name ||
      CASE WHEN advisor2.id IS NOT NULL THEN ' / ' || advisor2.prefix || advisor2.first_name || ' ' || advisor2.last_name ELSE '' END AS advisor_name,
    (SELECT COUNT(*) FROM student_survey_responses r2
      WHERE r2.decision='ACCEPT' AND r2.public_locked=1
        AND strftime('%Y',r2.submitted_at)=strftime('%Y',r.submitted_at)
        AND (r2.submitted_at<r.submitted_at OR (r2.submitted_at=r.submitted_at AND r2.id<=r.id))) AS document_number
    FROM students s JOIN student_survey_responses r ON r.student_id=s.id
    LEFT JOIN student_device_assignments d ON d.student_id=s.id
    LEFT JOIN class_advisors ca1 ON ca1.grade_level=s.grade_level AND ca1.room=s.room AND ca1.advisor_order=1
    LEFT JOIN teachers advisor1 ON advisor1.id=ca1.teacher_id
    LEFT JOIN class_advisors ca2 ON ca2.grade_level=s.grade_level AND ca2.room=s.room AND ca2.advisor_order=2
    LEFT JOIN teachers advisor2 ON advisor2.id=ca2.teacher_id
    WHERE s.id=? AND r.decision='ACCEPT' AND r.public_locked=1`).bind(studentId).first<{
      id:string;student_code:string;prefix:string;first_name:string;last_name:string;grade_level:string;room:string;phone:string|null;
      response_id:string;submitted_at:string;pii_ciphertext:string;pii_iv:string;serial_number:string|null;advisor_name:string|null;document_number:number;
    }>();
  if (!row?.pii_ciphertext || !row.pii_iv) return null;
  const pii = await decryptJson<StudentPersonalData>(row.pii_ciphertext,row.pii_iv);
  return {
    id:row.id,
    documentNumber:Number(row.document_number||1),
    documentYear:new Date(row.submitted_at).getUTCFullYear()+543,
    borrowerName:`${row.prefix}${row.first_name} ${row.last_name}`,
    studentCode:row.student_code,
    gradeLevel:row.grade_level,
    room:row.room,
    advisorName:row.advisor_name??"",
    phone:row.phone??"",
    serialNumber:row.serial_number??"",
    settings,
    ...pii,
    guardianPrefix:pii.guardianPrefix??"",
  };
}

export interface StudentPrintFilters {
  search?: string;
  grade?: string;
  room?: string;
  status?: string;
  approval?: string;
}

export async function getAcceptedStudentIds(filters: StudentPrintFilters = {}): Promise<string[]> {
  if (filters.status && filters.status !== "ACCEPT") return [];

  const db = await ensureDatabase();
  const clauses = ["s.is_active=1", "r.decision='ACCEPT'", "r.public_locked=1"];
  const values: string[] = [];
  const grade = filters.grade?.trim();
  const room = filters.room?.trim();
  const approval = filters.approval?.trim();
  const search = filters.search?.trim();

  if (grade) {
    clauses.push("s.grade_level=?");
    values.push(grade);
  }
  if (room) {
    clauses.push("s.room=?");
    values.push(room);
  }
  if (approval) {
    clauses.push("COALESCE(r.approval_status,'PENDING')=?");
    values.push(approval);
  }
  if (search) {
    clauses.push(`(s.student_code LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?
      OR (s.prefix || s.first_name || ' ' || s.last_name) LIKE ?)`);
    const pattern = `%${search}%`;
    values.push(pattern,pattern,pattern,pattern);
  }

  const result = await db.prepare(`SELECT s.id FROM students s
    JOIN student_survey_responses r ON r.student_id=s.id
    WHERE ${clauses.join(" AND ")}
    ORDER BY s.grade_level,s.room,s.class_number,r.submitted_at,r.id`).bind(...values).all<{id:string}>();
  return (result.results ?? []).map(row => row.id);
}
