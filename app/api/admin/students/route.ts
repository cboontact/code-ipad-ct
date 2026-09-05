import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";
import { decryptJson, encryptJson } from "@/lib/security/crypto";
import { isGuardianNameSameAsStudent, studentPiiSchema, type StudentPersonalData } from "@/lib/validation/survey";
import { normalizeStudentGrade, normalizeStudentRoom, studentGradeOptions, studentRoomOptions } from "@/lib/data/student-options";
import { isNdlpEmail, isSchoolEmail } from "@/lib/validation/email-domains";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const inputSchema = z.object({
  action: z.string().min(1),
  id: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
});

type StudentDatabase = Awaited<ReturnType<typeof ensureDatabase>>;

async function renumberStudentClasses(db: StudentDatabase) {
  const result = await db.prepare(`SELECT id,prefix,student_code,grade_level,room,class_number
    FROM students WHERE is_active=1
    ORDER BY grade_level,CAST(room AS INTEGER),room,
      CASE WHEN prefix IN ('เด็กชาย','นาย','ด.ช.','ดช.') THEN 0 WHEN prefix IN ('เด็กหญิง','นางสาว','ด.ญ.','ดญ.') THEN 1 ELSE 2 END,
      CAST(student_code AS INTEGER),student_code`).all<{id:string;prefix:string;student_code:string;grade_level:string;room:string;class_number:string|null}>();
  let classKey = "", classNumber = 0;
  const updates = [];
  for (const student of result.results ?? []) {
    const nextKey = `${student.grade_level}\u0000${student.room}`;
    classNumber = nextKey === classKey ? classNumber + 1 : 1;
    classKey = nextKey;
    if (student.class_number !== String(classNumber)) {
      updates.push(db.prepare("UPDATE students SET class_number=? WHERE id=?").bind(String(classNumber),student.id));
    }
  }
  for (let index = 0; index < updates.length; index += 100) {
    await db.batch(updates.slice(index,index+100));
  }
}

async function hasActiveDeviceHandover(db: StudentDatabase, studentId?: string) {
  if (!studentId) return false;
  return Boolean(await db.prepare("SELECT student_id FROM student_device_handovers WHERE student_id=? AND status='ACTIVE'").bind(studentId).first());
}

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const db = await ensureDatabase();
    await renumberStudentClasses(db);
    const url = new URL(request.url);
    const studentId = url.searchParams.get("id");
    if (studentId) {
      const student = await db.prepare(`SELECT s.*,r.id AS response_id,r.decision,r.submitted_at,r.public_locked,
        r.approval_status,r.approved_at,r.approved_by,r.approval_note,
        r.pii_ciphertext,r.pii_iv,d.serial_number,d.asset_number,
        advisor1.id AS advisor1_teacher_id,advisor2.id AS advisor2_teacher_id,
        advisor1.prefix || advisor1.first_name || ' ' || advisor1.last_name ||
          CASE WHEN advisor2.id IS NOT NULL THEN ' / ' || advisor2.prefix || advisor2.first_name || ' ' || advisor2.last_name ELSE '' END AS advisor_name
        FROM students s LEFT JOIN student_survey_responses r ON r.student_id=s.id
        LEFT JOIN student_device_assignments d ON d.student_id=s.id
        LEFT JOIN class_advisors ca1 ON ca1.grade_level=s.grade_level AND ca1.room=s.room AND ca1.advisor_order=1
        LEFT JOIN teachers advisor1 ON advisor1.id=ca1.teacher_id
        LEFT JOIN class_advisors ca2 ON ca2.grade_level=s.grade_level AND ca2.room=s.room AND ca2.advisor_order=2
        LEFT JOIN teachers advisor2 ON advisor2.id=ca2.teacher_id
        WHERE s.id=?`).bind(studentId)
        .first<Record<string, unknown> & { pii_ciphertext?: string; pii_iv?: string }>();
      if (!student) return json({ error: "ไม่พบข้อมูลนักเรียน" }, 404);
      let pii: StudentPersonalData | null = null;
      if (student.pii_ciphertext && student.pii_iv) {
        pii = await decryptJson<StudentPersonalData>(student.pii_ciphertext, student.pii_iv);
      }
      delete student.pii_ciphertext;
      delete student.pii_iv;
      return json({ student, pii });
    }
    const rows = await db.prepare(`SELECT s.id,s.student_code,s.prefix,s.first_name,s.last_name,s.grade_level,s.room,s.class_number,
      s.birth_date,s.phone,s.school_email,s.ndlp_email,s.is_active,s.sort_order,
      CASE WHEN r.id IS NULL OR r.public_locked=0 THEN 'PENDING' ELSE r.decision END AS survey_status,
      CASE WHEN r.public_locked=1 THEN r.submitted_at ELSE NULL END AS submitted_at,
      r.public_locked,r.approval_status,r.approved_at,r.approval_note,d.serial_number,
      advisor1.prefix || advisor1.first_name || ' ' || advisor1.last_name ||
        CASE WHEN advisor2.id IS NOT NULL THEN ' / ' || advisor2.prefix || advisor2.first_name || ' ' || advisor2.last_name ELSE '' END AS advisor_name
      FROM students s LEFT JOIN student_survey_responses r ON r.student_id=s.id
      LEFT JOIN student_device_assignments d ON d.student_id=s.id
      LEFT JOIN class_advisors ca1 ON ca1.grade_level=s.grade_level AND ca1.room=s.room AND ca1.advisor_order=1
      LEFT JOIN teachers advisor1 ON advisor1.id=ca1.teacher_id
      LEFT JOIN class_advisors ca2 ON ca2.grade_level=s.grade_level AND ca2.room=s.room AND ca2.advisor_order=2
      LEFT JOIN teachers advisor2 ON advisor2.id=ca2.teacher_id
      ORDER BY s.grade_level,CAST(s.room AS INTEGER),s.room,CAST(s.class_number AS INTEGER),s.first_name`).all();
    const totals = await db.prepare(`SELECT COUNT(s.id) AS total,
      SUM(CASE WHEN r.id IS NOT NULL AND r.public_locked=1 THEN 1 ELSE 0 END) AS responded,
      SUM(CASE WHEN r.decision='ACCEPT' AND r.public_locked=1 THEN 1 ELSE 0 END) AS accepted,
      SUM(CASE WHEN r.decision='DECLINE' AND r.public_locked=1 THEN 1 ELSE 0 END) AS declined,
      SUM(CASE WHEN r.decision='ACCEPT' AND r.public_locked=1 AND COALESCE(r.approval_status,'PENDING')='PENDING' THEN 1 ELSE 0 END) AS awaiting_approval,
      SUM(CASE WHEN r.decision='ACCEPT' AND r.public_locked=1 AND r.approval_status='APPROVED' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN r.decision='ACCEPT' AND r.public_locked=1 AND r.approval_status='REJECTED' THEN 1 ELSE 0 END) AS rejected
      FROM students s LEFT JOIN student_survey_responses r ON r.student_id=s.id WHERE s.is_active=1`).first();
    return json({ rows: rows.results ?? [], totals });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request);
    const input = inputSchema.parse(await request.json());
    const db = await ensureDatabase();
    const stamp = now();
    const data = input.data ?? {};

    if (input.action === "save") {
      if (input.id && data.isActive === false && await hasActiveDeviceHandover(db,input.id))
        return json({ error: "ปิดใช้งานนักเรียนไม่ได้ เนื่องจากยังถือเครื่องอยู่ กรุณารับคืนเครื่องก่อน" }, 409);
      const studentId = input.id ?? id();
      const studentCode = clean(data.studentCode, 30);
      const prefix = clean(data.prefix, 20);
      const firstName = clean(data.firstName, 100);
      const lastName = clean(data.lastName, 100);
      const gradeLevel = normalizeStudentGrade(clean(data.gradeLevel, 30));
      const room = normalizeStudentRoom(clean(data.room, 20));
      const birthDate = clean(data.birthDate, 10);
      const phone = clean(data.phone, 20);
      const email = clean(data.email, 180);
      const ndlpEmail = clean(data.ndlpEmail, 180);
      if (!studentCode || !prefix || !firstName || !lastName || !studentGradeOptions.includes(gradeLevel as typeof studentGradeOptions[number]) || !studentRoomOptions.includes(room)) {
        return json({ error: "กรุณากรอกรหัสนักเรียน ชื่อ ชั้น และห้องให้ครบ" }, 400);
      }
      if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return json({ error: "รูปแบบวันเกิดไม่ถูกต้อง" }, 400);
      if (email && !isSchoolEmail(email)) return json({ error: "อีเมลโรงเรียนต้องลงท้ายด้วย @chomthong.ac.th" }, 400);
      if (ndlpEmail && !isNdlpEmail(ndlpEmail)) return json({ error: "อีเมล NDLP ต้องลงท้ายด้วย @ndlp.go.th" }, 400);
      if (input.id) {
        await db.prepare(`UPDATE students SET student_code=?,prefix=?,first_name=?,last_name=?,grade_level=?,room=?,birth_date=?,phone=?,school_email=?,ndlp_email=?,is_active=?,sort_order=?,updated_at=? WHERE id=?`)
          .bind(studentCode,prefix,firstName,lastName,gradeLevel,room,birthDate,phone||null,email||null,ndlpEmail||null,data.isActive===false?0:1,Number(data.sortOrder??0),stamp,studentId).run();
      } else {
        await db.prepare(`INSERT INTO students (id,student_code,prefix,first_name,last_name,grade_level,room,class_number,birth_date,phone,school_email,ndlp_email,is_active,sort_order,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)`).bind(studentId,studentCode,prefix,firstName,lastName,gradeLevel,room,null,birthDate,phone||null,email||null,ndlpEmail||null,stamp,stamp).run();
      }
      await renumberStudentClasses(db);
      await audit(db,admin.id,input.id?"EDIT_STUDENT":"CREATE_STUDENT","student",studentId,`${input.id?"แก้ไข":"เพิ่ม"}นักเรียน ${prefix}${firstName} ${lastName}`);
      return json({ success: true, id: studentId });
    }

    if (input.action === "save-detail") {
      if (!input.id) return json({ error: "ไม่พบข้อมูลนักเรียน" }, 400);
      if (data.isActive === false && await hasActiveDeviceHandover(db,input.id))
        return json({ error: "ปิดใช้งานนักเรียนไม่ได้ เนื่องจากยังถือเครื่องอยู่ กรุณารับคืนเครื่องก่อน" }, 409);
      const studentCode = clean(data.studentCode,30), prefix = clean(data.prefix,20), firstName = clean(data.firstName,100), lastName = clean(data.lastName,100), gradeLevel = normalizeStudentGrade(clean(data.gradeLevel,30)), room = normalizeStudentRoom(clean(data.room,20)), birthDate = clean(data.birthDate,10), phone = clean(data.phone,20), email = clean(data.email,180), ndlpEmail = clean(data.ndlpEmail,180);
      if (!studentCode || !prefix || !firstName || !lastName || !studentGradeOptions.includes(gradeLevel as typeof studentGradeOptions[number]) || !studentRoomOptions.includes(room) || (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)))
        return json({ error: "กรุณากรอกข้อมูลนักเรียนให้ครบ" }, 400);
      if (phone && !/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/.test(phone))
        return json({ error: "กรุณากรอกเบอร์โทรศัพท์นักเรียนให้ถูกต้อง" }, 400);
      if (email && !isSchoolEmail(email)) return json({ error: "อีเมลโรงเรียนต้องลงท้ายด้วย @chomthong.ac.th" }, 400);
      if (ndlpEmail && !isNdlpEmail(ndlpEmail)) return json({ error: "อีเมล NDLP ต้องลงท้ายด้วย @ndlp.go.th" }, 400);
      const response = await db.prepare("SELECT id,decision,approval_status FROM student_survey_responses WHERE student_id=?").bind(input.id).first<{id:string;decision:string;approval_status:string}>();
      let pii: StudentPersonalData | null = null;
      if (response?.decision === "ACCEPT") {
        pii = studentPiiSchema.parse({
          citizenId:clean(data.citizenId,13),guardianPrefix:clean(data.guardianPrefix,20),guardianName:clean(data.guardianName,200),guardianPhone:clean(data.guardianPhone,20),
          houseNo:clean(data.houseNo,30),moo:clean(data.moo,20),soi:clean(data.soi,100),road:clean(data.road,100),
          subdistrict:clean(data.subdistrict,100),district:clean(data.district,100),province:clean(data.province,100),postalCode:clean(data.postalCode,5),
        });
        if (isGuardianNameSameAsStudent(pii.guardianName, `${firstName} ${lastName}`))
          return json({ error: "ชื่อผู้ปกครองต้องไม่เป็นชื่อเดียวกับนักเรียน กรุณาตรวจสอบอีกครั้ง" }, 400);
      }
      await db.prepare(`UPDATE students SET student_code=?,prefix=?,first_name=?,last_name=?,grade_level=?,room=?,birth_date=?,phone=?,school_email=?,ndlp_email=?,is_active=?,updated_at=? WHERE id=?`)
        .bind(studentCode,prefix,firstName,lastName,gradeLevel,room,birthDate,phone||null,email||null,ndlpEmail||null,data.isActive===false?0:1,stamp,input.id).run();
      await renumberStudentClasses(db);
      if (pii) {
        const encrypted = await encryptJson(pii);
        await db.prepare("UPDATE student_survey_responses SET pii_ciphertext=?,pii_iv=?,updated_at=?,updated_by_admin_id=? WHERE student_id=?")
          .bind(encrypted.ciphertext,encrypted.iv,stamp,admin.id,input.id).run();
      }
      if (response?.approval_status === "APPROVED" && Object.prototype.hasOwnProperty.call(data,"serialNumber")) {
        const serialNumber = clean(data.serialNumber,100);
        await db.prepare(`INSERT INTO student_device_assignments (id,student_id,asset_number,serial_number,created_at,updated_at)
          VALUES (?,?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET serial_number=excluded.serial_number,updated_at=excluded.updated_at`)
          .bind(id(),input.id,null,serialNumber||null,stamp,stamp).run();
      }
      await audit(db,admin.id,"EDIT_STUDENT_DETAIL","student",input.id,"แก้ไขข้อมูลนักเรียนและข้อมูล AWAT-03");
      return json({ success:true });
    }

    if (input.action === "delete") {
      if (await hasActiveDeviceHandover(db,input.id))
        return json({ error: "ลบนักเรียนไม่ได้ เนื่องจากยังถือเครื่องอยู่ กรุณารับคืนเครื่องก่อน" }, 409);
      const response = await db.prepare("SELECT id FROM student_survey_responses WHERE student_id=?").bind(input.id).first();
      if (response) await db.prepare("UPDATE students SET is_active=0,updated_at=? WHERE id=?").bind(stamp,input.id).run();
      else await db.prepare("DELETE FROM students WHERE id=?").bind(input.id).run();
      await renumberStudentClasses(db);
      await audit(db,admin.id,"DELETE_STUDENT","student",input.id??null,"ลบหรือปิดใช้งานนักเรียน");
      return json({ success: true });
    }

    if (input.action === "approve" || input.action === "reject") {
      if (!input.id) return json({ error: "ไม่พบข้อมูลนักเรียน" }, 400);
      if (input.action === "reject" && await hasActiveDeviceHandover(db,input.id))
        return json({ error: "ไม่อนุมัติรายการไม่ได้ เนื่องจากนักเรียนรับเครื่องแล้ว กรุณารับคืนเครื่องก่อน" }, 409);
      const response = await db.prepare(`SELECT r.id,s.prefix,s.first_name,s.last_name
        FROM student_survey_responses r JOIN students s ON s.id=r.student_id
        WHERE r.student_id=? AND r.decision='ACCEPT' AND r.public_locked=1`)
        .bind(input.id).first<{id:string;prefix:string;first_name:string;last_name:string}>();
      if (!response) return json({ error: "อนุมัติได้เฉพาะนักเรียนที่ลงทะเบียนรับ iPad แล้ว" }, 409);
      const approvalStatus = input.action === "approve" ? "APPROVED" : "REJECTED";
      const approvalNote = clean(data.note, 500) || null;
      await db.prepare(`UPDATE student_survey_responses
        SET approval_status=?,approved_at=?,approved_by=?,approval_note=?,updated_at=?,updated_by_admin_id=?
        WHERE student_id=?`)
        .bind(approvalStatus,stamp,admin.id,approvalNote,stamp,admin.id,input.id).run();
      await audit(db,admin.id,input.action === "approve" ? "APPROVE_STUDENT_IPAD" : "REJECT_STUDENT_IPAD","student",input.id,
        `${input.action === "approve" ? "อนุมัติ" : "ไม่อนุมัติ"}การรับ iPad ของ ${response.prefix}${response.first_name} ${response.last_name}`);
      return json({ success: true, approvalStatus, approvedAt: stamp });
    }

    if (input.action === "serial") {
      const serialNumber = clean(data.serialNumber, 100);
      if (!input.id) return json({ error: "ไม่พบข้อมูลนักเรียน" }, 400);
      const student = await db.prepare("SELECT id FROM students WHERE id=? AND is_active=1")
        .bind(input.id).first<{id:string}>();
      if (!student) return json({ error: "ไม่พบข้อมูลนักเรียน" }, 404);
      const acceptedResponse = await db.prepare("SELECT id FROM student_survey_responses WHERE student_id=? AND decision='ACCEPT' AND public_locked=1 AND approval_status='APPROVED'")
        .bind(input.id).first<{id:string}>();
      if (!acceptedResponse)
        return json({ error: "บันทึก Serial Number ได้หลังผู้ดูแลอนุมัติการรับ iPad แล้วเท่านั้น" }, 409);
      await db.prepare(`INSERT INTO student_device_assignments (id,student_id,asset_number,serial_number,created_at,updated_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET serial_number=excluded.serial_number,updated_at=excluded.updated_at`)
        .bind(id(),input.id,null,serialNumber||null,stamp,stamp).run();
      await audit(db,admin.id,"EDIT_STUDENT_SERIAL","student",input.id,`แก้ไข Serial Number เป็น ${serialNumber||"ไม่ระบุ"}`);
      return json({ success: true });
    }

    if (input.action === "reset") {
      if (await hasActiveDeviceHandover(db,input.id))
        return json({ error: "เปิดลงทะเบียนใหม่ไม่ได้ เนื่องจากนักเรียนยังถือเครื่องอยู่ กรุณารับคืนเครื่องก่อน" }, 409);
      await db.batch([
        db.prepare("DELETE FROM student_device_assignments WHERE student_id=?").bind(input.id),
        db.prepare("DELETE FROM student_survey_responses WHERE student_id=?").bind(input.id),
      ]);
      await audit(db,admin.id,"RESET_STUDENT_SURVEY","student",input.id??null,"เปิดให้นักเรียนลงทะเบียนใหม่");
      return json({ success: true });
    }

    if (input.action === "reopen") {
      if (await hasActiveDeviceHandover(db,input.id))
        return json({ error: "เปิดให้แก้ไขไม่ได้ เนื่องจากนักเรียนยังถือเครื่องอยู่ กรุณารับคืนเครื่องก่อน" }, 409);
      await db.prepare(`UPDATE student_survey_responses SET public_locked=0,approval_status='PENDING',approved_at=NULL,
        approved_by=NULL,approval_note=NULL,updated_at=?,updated_by_admin_id=? WHERE student_id=?`)
        .bind(stamp,admin.id,input.id).run();
      await audit(db,admin.id,"REOPEN_STUDENT_SURVEY","student",input.id??null,"เปิดให้นักเรียนแก้ไขคำตอบหนึ่งครั้ง");
      return json({ success: true });
    }

    if (input.action === "import") {
      const rows = input.rows ?? [];
      if (!rows.length) return json({ error: "ไม่พบข้อมูลสำหรับนำเข้า" }, 400);
      let inserted = 0, updated = 0, skipped = 0;
      for (const row of rows.slice(0, 3000)) {
        const studentCode = clean(row.studentCode,30), prefix = clean(row.prefix,20), firstName = clean(row.firstName,100), lastName = clean(row.lastName,100), gradeLevel = normalizeStudentGrade(clean(row.gradeLevel,30)), room = normalizeStudentRoom(clean(row.room,20)), birthDate = clean(row.birthDate,10), email = clean(row.email,180), ndlpEmail = clean(row.ndlpEmail,180);
        if (!studentCode || !prefix || !firstName || !lastName || !studentGradeOptions.includes(gradeLevel as typeof studentGradeOptions[number]) || !studentRoomOptions.includes(room) || (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) || (email && !isSchoolEmail(email)) || (ndlpEmail && !isNdlpEmail(ndlpEmail))) { skipped++; continue; }
        const existing = await db.prepare("SELECT id FROM students WHERE student_code=?").bind(studentCode).first<{id:string}>();
        if (existing) {
          await db.prepare("UPDATE students SET prefix=?,first_name=?,last_name=?,grade_level=?,room=?,birth_date=?,phone=?,school_email=?,ndlp_email=?,is_active=1,updated_at=? WHERE id=?")
            .bind(prefix,firstName,lastName,gradeLevel,room,birthDate,clean(row.phone,20)||null,email||null,ndlpEmail||null,stamp,existing.id).run();
          updated++;
        } else {
          await db.prepare(`INSERT INTO students (id,student_code,prefix,first_name,last_name,grade_level,room,class_number,birth_date,phone,school_email,ndlp_email,is_active,sort_order,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)`).bind(id(),studentCode,prefix,firstName,lastName,gradeLevel,room,null,birthDate,clean(row.phone,20)||null,email||null,ndlpEmail||null,stamp,stamp).run();
          inserted++;
        }
      }
      await renumberStudentClasses(db);
      await audit(db,admin.id,"IMPORT_STUDENTS","student",null,`นำเข้านักเรียน เพิ่ม ${inserted} แก้ไข ${updated} ข้าม ${skipped}`);
      return json({ success:true, inserted, updated, skipped });
    }
    return json({ error: "ไม่รองรับคำสั่งนี้" }, 400);
  } catch (error) {
    return apiError(error);
  }
}
