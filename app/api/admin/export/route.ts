import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase } from "@/lib/db/runtime";
import { decryptJson } from "@/lib/security/crypto";
import type { PersonalData, StudentPersonalData } from "@/lib/validation/survey";
import { apiError, json } from "@/lib/http";

export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const url=new URL(request.url),type=url.searchParams.get("type")==="full"?"full":"summary",admin=await requireAdminApi(request,type==="full"?"superadmin":undefined),db=await ensureDatabase();
    if(url.searchParams.get("audience")==="students"){
      const decision=url.searchParams.get("decision"),approval=url.searchParams.get("approval"),grade=url.searchParams.get("grade"),room=url.searchParams.get("room"),search=url.searchParams.get("search")?.trim().toLowerCase(),clauses=["s.is_active=1"],bindings:unknown[]=[];
      if(decision&&["ACCEPT","DECLINE","PENDING"].includes(decision)){if(decision==="PENDING")clauses.push("(r.id IS NULL OR r.public_locked=0)");else{clauses.push("r.decision=? AND r.public_locked=1");bindings.push(decision);}}
      if(grade){clauses.push("s.grade_level=?");bindings.push(grade);} if(room){clauses.push("s.room=?");bindings.push(room);}
      if(approval&&["PENDING","APPROVED","REJECTED"].includes(approval)){clauses.push("r.public_locked=1 AND r.decision='ACCEPT' AND COALESCE(r.approval_status,'PENDING')=?");bindings.push(approval);}
      if(search){clauses.push(`(instr(lower(COALESCE(s.student_code,'')),?)>0 OR instr(lower(COALESCE(s.prefix,'')),?)>0 OR instr(lower(COALESCE(s.first_name,'')),?)>0 OR instr(lower(COALESCE(s.last_name,'')),?)>0 OR instr(lower(COALESCE(s.room,'')),?)>0)`);bindings.push(search,search,search,search,search);}
      const result=await db.prepare(`SELECT s.student_code,s.prefix,s.first_name,s.last_name,s.grade_level,s.room,s.class_number,s.birth_date,s.phone,
        advisor1.prefix || advisor1.first_name || ' ' || advisor1.last_name ||
          CASE WHEN advisor2.id IS NOT NULL THEN ' / ' || advisor2.prefix || advisor2.first_name || ' ' || advisor2.last_name ELSE '' END AS advisor_name,
        CASE WHEN r.public_locked=1 THEN r.decision ELSE NULL END AS decision,
        CASE WHEN r.public_locked=1 AND r.decision='ACCEPT' THEN COALESCE(r.approval_status,'PENDING') ELSE NULL END AS approval_status,
        CASE WHEN r.public_locked=1 THEN r.approved_at ELSE NULL END AS approved_at,
        CASE WHEN r.public_locked=1 THEN r.approval_note ELSE NULL END AS approval_note,
        CASE WHEN r.public_locked=1 THEN r.submitted_at ELSE NULL END AS submitted_at,
        CASE WHEN r.public_locked=1 THEN r.pii_ciphertext ELSE NULL END AS pii_ciphertext,
        CASE WHEN r.public_locked=1 THEN r.pii_iv ELSE NULL END AS pii_iv,
        d.asset_number,d.serial_number
        FROM students s LEFT JOIN student_survey_responses r ON r.student_id=s.id LEFT JOIN student_device_assignments d ON d.student_id=s.id
        LEFT JOIN class_advisors ca1 ON ca1.grade_level=s.grade_level AND ca1.room=s.room AND ca1.advisor_order=1
        LEFT JOIN teachers advisor1 ON advisor1.id=ca1.teacher_id
        LEFT JOIN class_advisors ca2 ON ca2.grade_level=s.grade_level AND ca2.room=s.room AND ca2.advisor_order=2
        LEFT JOIN teachers advisor2 ON advisor2.id=ca2.teacher_id
        WHERE ${clauses.join(" AND ")} ORDER BY s.grade_level,s.room,s.class_number,s.first_name,s.last_name`).bind(...bindings).all<Record<string,unknown>&{pii_ciphertext?:string;pii_iv?:string}>();
      const rows=[];for(const row of result.results??[]){const output={...row};delete output.pii_ciphertext;delete output.pii_iv;if(type==="full"&&row.pii_ciphertext&&row.pii_iv)Object.assign(output,await decryptJson<StudentPersonalData>(row.pii_ciphertext,row.pii_iv));rows.push(output);}
      if(type==="full")await audit(db,admin.id,"EXPORT_STUDENT_FULL_DATA","student_survey_response",null,`ส่งออกข้อมูลส่วนบุคคลนักเรียน ${rows.length} ราย`);
      return json({type,audience:"students",exportedAt:new Date().toISOString(),rows});
    }
    const decision=url.searchParams.get("decision"),area=url.searchParams.get("area"); const clauses=["1=1"],bindings:unknown[]=[];
    if(decision&&["ACCEPT","DECLINE","PENDING"].includes(decision)){if(decision==="PENDING")clauses.push("r.id IS NULL");else{clauses.push("r.decision=?");bindings.push(decision);}}
    if(area){clauses.push("t.learning_area_id=?");bindings.push(area);}
    const result=await db.prepare(`SELECT t.teacher_code,t.prefix,t.first_name,t.last_name,a.name AS learning_area,t.position,t.academic_rank,t.email,t.ndlp_email,t.phone,
      r.decision,r.submitted_at,r.pii_ciphertext,r.pii_iv,d.asset_number,d.serial_number,d.device_identifier,d.accessories,d.note AS device_note
      FROM teachers t JOIN learning_areas a ON a.id=t.learning_area_id LEFT JOIN survey_responses r ON r.teacher_id=t.id LEFT JOIN device_assignments d ON d.teacher_id=t.id
      WHERE ${clauses.join(" AND ")} ORDER BY a.sort_order,t.first_name,t.last_name`).bind(...bindings).all<Record<string,unknown>&{pii_ciphertext?:string;pii_iv?:string}>();
    const rows=[]; for(const row of result.results??[]){const output={...row};delete output.pii_ciphertext;delete output.pii_iv;if(type==="full"&&row.pii_ciphertext&&row.pii_iv)Object.assign(output,await decryptJson<PersonalData>(row.pii_ciphertext,row.pii_iv));rows.push(output);}
    if(type==="full")await audit(db,admin.id,"EXPORT_FULL_DATA","survey_response",null,`ส่งออกข้อมูลส่วนบุคคล ${rows.length} ราย`);
    return json({type,exportedAt:new Date().toISOString(),rows});
  }catch(error){return apiError(error);}
}
