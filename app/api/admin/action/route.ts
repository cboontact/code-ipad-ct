import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase, generateTeacherCode, getSettings, id, invalidateSettingsCache, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";
import { encryptJson } from "@/lib/security/crypto";
import { piiSchema } from "@/lib/validation/survey";
import { positionOptions } from "@/lib/data/teacher-options";
import { isNdlpEmail, isSchoolEmail } from "@/lib/validation/email-domains";

const base = z.object({ action: z.string().min(1), id: z.string().optional(), data: z.record(z.string(), z.unknown()).optional() });
const clean = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
async function teacherQuotaError(db: D1Database, teacherId: string | undefined) {
  if (!teacherId) return "ไม่พบข้อมูลครู";
  const current = await db.prepare("SELECT decision,public_locked FROM survey_responses WHERE teacher_id=?")
    .bind(teacherId).first<{decision:string;public_locked:number}>();
  if (current?.decision === "ACCEPT" && current.public_locked === 1) return null;
  const settings = await getSettings(db);
  const configuredQuota = Number.parseInt(settings.teacher_ipad_quota ?? "127", 10);
  const capacity = Number.isFinite(configuredQuota) && configuredQuota >= 0 ? configuredQuota : 127;
  const accepted = await db.prepare(`SELECT COUNT(*) AS count FROM survey_responses r JOIN teachers t ON t.id=r.teacher_id
    WHERE t.is_active=1 AND r.decision='ACCEPT' AND r.public_locked=1`).first<{count:number}>();
  return Number(accepted?.count ?? 0) >= capacity
    ? "iPad สำหรับครูและบุคลากรมีผู้ลงทะเบียนรับครบตามจำนวนแล้ว"
    : null;
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const admin = await requireAdminApi(request), input = base.parse(await request.json()), db = await ensureDatabase(), stamp = now(), data = input.data ?? {};
    if (input.action === "save-area") {
      const areaId = input.id ?? id(), name = clean(data.name, 120), code = clean(data.code, 30).toUpperCase(), icon = clean(data.icon, 40) || "book-open", sort = Number(data.sortOrder ?? 0);
      if (!name || !code) return json({ error: "กรุณากรอกชื่อและรหัสกลุ่มสาระ" }, 400);
      if (input.id) await db.prepare("UPDATE learning_areas SET code=?,name=?,icon=?,sort_order=?,is_active=?,updated_at=? WHERE id=?").bind(code,name,icon,sort,data.isActive === false ? 0 : 1,stamp,areaId).run();
      else await db.prepare("INSERT INTO learning_areas (id,code,name,icon,sort_order,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)").bind(areaId,code,name,icon,sort,stamp,stamp).run();
      await audit(db, admin.id, input.id ? "EDIT_LEARNING_AREA" : "CREATE_LEARNING_AREA", "learning_area", areaId, `${input.id ? "แก้ไข" : "เพิ่ม"}กลุ่มสาระ ${name}`); return json({ success: true, id: areaId });
    }
    if (input.action === "delete-area") {
      const count = await db.prepare("SELECT COUNT(*) AS count FROM teachers WHERE learning_area_id=?").bind(input.id).first<{ count: number }>();
      if ((count?.count ?? 0) > 0) { await db.prepare("UPDATE learning_areas SET is_active=0,updated_at=? WHERE id=?").bind(stamp,input.id).run(); }
      else await db.prepare("DELETE FROM learning_areas WHERE id=?").bind(input.id).run();
      await audit(db, admin.id, "DELETE_LEARNING_AREA", "learning_area", input.id ?? null, "ลบหรือปิดใช้งานกลุ่มสาระ"); return json({ success: true });
    }
    if (input.action === "save-teacher") {
      const teacherId = input.id ?? id(), prefix = clean(data.prefix, 20), first = clean(data.firstName, 100), last = clean(data.lastName, 100), areaId = clean(data.learningAreaId, 80);
      if (!prefix || !first || !last || !areaId) return json({ error: "กรุณากรอกชื่อและกลุ่มสาระให้ครบ" }, 400);
      const position = clean(data.position, 120);
      if (position && !positionOptions.some((option) => option === position)) return json({ error: "กรุณาเลือกตำแหน่งให้ถูกต้อง" }, 400);
      const email = clean(data.email,180), ndlpEmail = clean(data.ndlpEmail,180), phone = clean(data.phone,20);
      if (email && !isSchoolEmail(email)) return json({ error: "อีเมลโรงเรียนต้องลงท้ายด้วย @chomthong.ac.th" }, 400);
      if (ndlpEmail && !isNdlpEmail(ndlpEmail)) return json({ error: "อีเมล NDLP ต้องลงท้ายด้วย @ndlp.go.th" }, 400);
      if (phone && !/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/.test(phone)) return json({ error: "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง" }, 400);
      const values = [prefix,first,last,areaId,position||null,clean(data.academicRank,120)||null,email||null,ndlpEmail||null,phone||null,data.isActive === false?0:1,Number(data.sortOrder??0),stamp];
      if (input.id) await db.prepare("UPDATE teachers SET prefix=?,first_name=?,last_name=?,learning_area_id=?,position=?,academic_rank=?,email=?,ndlp_email=?,phone=?,is_active=?,sort_order=?,updated_at=? WHERE id=?").bind(...values,teacherId).run();
      else await db.prepare("INSERT INTO teachers (id,teacher_code,prefix,first_name,last_name,learning_area_id,position,academic_rank,email,ndlp_email,phone,is_active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(teacherId,generateTeacherCode(),...values.slice(0,11),stamp,stamp).run();
      await audit(db,admin.id,input.id?"EDIT_TEACHER":"CREATE_TEACHER","teacher",teacherId,`${input.id?"แก้ไข":"เพิ่ม"}ครู ${prefix}${first} ${last}`); return json({ success:true,id:teacherId });
    }
    if (input.action === "delete-teacher") {
      const response = await db.prepare("SELECT id FROM survey_responses WHERE teacher_id=?").bind(input.id).first();
      const advisor = await db.prepare("SELECT id FROM class_advisors WHERE teacher_id=? LIMIT 1").bind(input.id).first();
      if (response || advisor) await db.prepare("UPDATE teachers SET is_active=0,updated_at=? WHERE id=?").bind(stamp,input.id).run(); else await db.prepare("DELETE FROM teachers WHERE id=?").bind(input.id).run();
      await audit(db,admin.id,"DELETE_TEACHER","teacher",input.id??null,"ลบหรือปิดใช้งานครู"); return json({success:true});
    }
    if (input.action === "reset-survey") {
      await db.batch([db.prepare("DELETE FROM device_assignments WHERE teacher_id=?").bind(input.id),db.prepare("DELETE FROM survey_responses WHERE teacher_id=?").bind(input.id)]);
      await audit(db,admin.id,"RESET_SURVEY","teacher",input.id??null,"เปิดให้ครูลงทะเบียนใหม่"); return json({success:true});
    }
    if (input.action === "reopen-survey") {
      await db.prepare("UPDATE survey_responses SET public_locked=0,updated_at=?,updated_by_admin_id=? WHERE teacher_id=?").bind(stamp,admin.id,input.id).run();
      await audit(db,admin.id,"REOPEN_SURVEY","teacher",input.id??null,"เปิดให้ครูแก้ไขคำตอบหนึ่งครั้ง"); return json({success:true});
    }
    if (input.action === "save-settings") {
      const editableSettings = new Set(["system_name","project_name","school_name","subdistrict","district","province","organization","device_brand","device_model","teacher_ipad_quota","student_ipad_quota","approver_name","teacher_approver_name","student_approver_name","hero_eyebrow","hero_title","hero_product_name","hero_product_suffix","hero_free_label","hero_audience","survey_end_date","teacher_survey_status","student_survey_status","teacher_registration_opens_at","teacher_registration_closes_at","student_registration_opens_at","student_registration_closes_at","student_lower_survey_status","student_lower_registration_opens_at","student_lower_registration_closes_at","student_upper_survey_status","student_upper_registration_opens_at","student_upper_registration_closes_at","announcement"]);
      const quotaSettings = new Set(["teacher_ipad_quota", "student_ipad_quota"]);
      const statusSettings = new Set(["teacher_survey_status", "student_survey_status", "student_lower_survey_status", "student_upper_survey_status"]);
      const scheduleSettings = new Set(["teacher_registration_opens_at","teacher_registration_closes_at","student_registration_opens_at","student_registration_closes_at","student_lower_registration_opens_at","student_lower_registration_closes_at","student_upper_registration_opens_at","student_upper_registration_closes_at"]);
      const currentSettings = await getSettings(db);
      const nextSettings = { ...currentSettings, ...Object.fromEntries(Object.entries(data).filter((entry): entry is [string,string] => typeof entry[1] === "string")) };
      for (const audience of ["teacher", "student_lower", "student_upper"] as const) {
        const opensAt = nextSettings[`${audience}_registration_opens_at`]?.trim() ?? "";
        const closesAt = nextSettings[`${audience}_registration_closes_at`]?.trim() ?? "";
        if ((opensAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(opensAt)) || (closesAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(closesAt)))
          return json({ error: "รูปแบบวันและเวลาเปิด–ปิดลงทะเบียนไม่ถูกต้อง" }, 400);
        if ([opensAt, closesAt].some((value) => value && !Number.isFinite(Date.parse(`${value}:00+07:00`))))
          return json({ error: "วันและเวลาเปิด–ปิดลงทะเบียนไม่ถูกต้อง" }, 400);
        if (opensAt && closesAt && Date.parse(`${opensAt}:00+07:00`) >= Date.parse(`${closesAt}:00+07:00`))
          return json({ error: `เวลาปิดลงทะเบียน${audience === "teacher" ? "ครู" : audience === "student_lower" ? "นักเรียน ม.ต้น" : "นักเรียน ม.ปลาย"}ต้องอยู่หลังเวลาเปิด` }, 400);
      }
      for (const [key,value] of Object.entries(data)) {
        if (typeof value !== "string" || !editableSettings.has(key)) continue;
        let settingValue = value.slice(0, 1000);
        if (quotaSettings.has(key)) {
          const quota = Number(value);
          if (!Number.isSafeInteger(quota) || quota < 0)
            return json({ error: "จำนวน iPad ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" }, 400);
          settingValue = String(quota);
        }
        if (statusSettings.has(key) && !["OPEN", "CLOSED"].includes(settingValue))
          return json({ error: "สถานะการลงทะเบียนไม่ถูกต้อง" }, 400);
        if (scheduleSettings.has(key)) settingValue = settingValue.trim();
        await db.prepare("INSERT INTO system_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(key,settingValue,stamp,admin.id).run();
      }
      invalidateSettingsCache();
      await audit(db,admin.id,"CHANGE_SETTINGS","system_settings",null,"แก้ไขการตั้งค่าระบบ"); return json({success:true});
    }
    if (input.action === "save-response") {
      const teacherId = input.id, decision = data.decision === "DECLINE" ? "DECLINE" : "ACCEPT", note = clean(data.adminNote,1000); let ciphertext:null|string=null,iv:null|string=null;
      if (decision === "ACCEPT") { const error = await teacherQuotaError(db, teacherId); if (error) return json({ error }, 409); }
      if (decision === "ACCEPT") { const pii = piiSchema.parse(data.pii); ({ciphertext,iv}=await encryptJson(pii)); }
      await db.prepare("UPDATE survey_responses SET decision=?,pii_ciphertext=?,pii_iv=?,admin_note=?,updated_at=?,updated_by_admin_id=?,public_locked=1 WHERE teacher_id=?").bind(decision,ciphertext,iv,note||null,stamp,admin.id,teacherId).run();
      await audit(db,admin.id,"EDIT_RESPONSE","survey_response",teacherId??null,"แก้ไขข้อมูลลงทะเบียนโดยผู้ดูแล"); return json({success:true});
    }
    if (input.action === "save-teacher-detail") {
      const teacherId = input.id;
      if (!teacherId) return json({ error: "ไม่พบข้อมูลครู" }, 400);
      const phone = clean(data.phone, 20);
      if (phone && !/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/.test(phone))
        return json({ error: "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง" }, 400);
      await db.prepare("UPDATE teachers SET phone=?,updated_at=? WHERE id=?").bind(phone || null, stamp, teacherId).run();

      const existingResponse = await db.prepare("SELECT id FROM survey_responses WHERE teacher_id=?").bind(teacherId).first();
      const decision = data.decision === "DECLINE" ? "DECLINE" : data.decision === "ACCEPT" ? "ACCEPT" : "";
      if (existingResponse && decision) {
        if (decision === "ACCEPT") { const error = await teacherQuotaError(db, teacherId); if (error) return json({ error }, 409); }
        let ciphertext: string | null = null, iv: string | null = null;
        if (decision === "ACCEPT") {
          const pii = piiSchema.parse(data.pii);
          ({ ciphertext, iv } = await encryptJson(pii));
        }
        await db.prepare("UPDATE survey_responses SET decision=?,pii_ciphertext=?,pii_iv=?,updated_at=?,updated_by_admin_id=?,public_locked=1 WHERE teacher_id=?").bind(decision,ciphertext,iv,stamp,admin.id,teacherId).run();
      }

      const assetNumber = clean(data.assetNumber, 100), serialNumber = clean(data.serialNumber, 100);
      if (data.hasDevice === true || assetNumber || serialNumber) {
        await db.prepare(`INSERT INTO device_assignments (id,teacher_id,asset_number,serial_number,device_identifier,accessories,note,assigned_at,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(teacher_id) DO UPDATE SET asset_number=excluded.asset_number,serial_number=excluded.serial_number,updated_at=excluded.updated_at`)
          .bind(id(),teacherId,assetNumber||null,serialNumber||null,null,null,null,clean(data.assignedAt,40)||null,stamp,stamp).run();
      }
      await audit(db,admin.id,"EDIT_TEACHER_DETAIL","teacher",teacherId,"แก้ไขข้อมูลครู การลงทะเบียน และอุปกรณ์");
      return json({ success: true });
    }
    if (input.action === "save-device") {
      const teacherId = input.id; await db.prepare(`INSERT INTO device_assignments (id,teacher_id,asset_number,serial_number,device_identifier,accessories,note,assigned_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(teacher_id) DO UPDATE SET asset_number=excluded.asset_number,serial_number=excluded.serial_number,device_identifier=excluded.device_identifier,accessories=excluded.accessories,note=excluded.note,assigned_at=excluded.assigned_at,updated_at=excluded.updated_at`)
        .bind(id(),teacherId,clean(data.assetNumber,100)||null,clean(data.serialNumber,100)||null,clean(data.deviceIdentifier,100)||null,clean(data.accessories,500)||null,clean(data.note,1000)||null,clean(data.assignedAt,40)||null,stamp,stamp).run();
      await audit(db,admin.id,"ASSIGN_DEVICE","teacher",teacherId??null,"บันทึกข้อมูลอุปกรณ์"); return json({success:true});
    }
    if (input.action === "save-serial-number") {
      const teacherId = input.id, serialNumber = clean(data.serialNumber, 100);
      if (!teacherId) return json({ error: "ไม่พบข้อมูลครู" }, 400);
      const assignment = await db.prepare("SELECT id FROM device_assignments WHERE teacher_id=?").bind(teacherId).first<{ id: string }>();
      if (assignment) {
        await db.prepare("UPDATE device_assignments SET serial_number=?,updated_at=? WHERE teacher_id=?").bind(serialNumber || null,stamp,teacherId).run();
      } else {
        await db.prepare(`INSERT INTO device_assignments (id,teacher_id,asset_number,serial_number,device_identifier,accessories,note,assigned_at,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id(),teacherId,null,serialNumber||null,null,null,null,null,stamp,stamp).run();
      }
      await audit(db,admin.id,"EDIT_SERIAL_NUMBER","teacher",teacherId,`แก้ไข Serial Number เป็น ${serialNumber || "ไม่ระบุ"}`);
      return json({ success: true });
    }
    return json({error:"ไม่รองรับคำสั่งนี้"},400);
  } catch (error) { return apiError(error); }
}
