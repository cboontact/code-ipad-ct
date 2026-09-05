import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth/admin";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("handover"), teacherId: z.string().uuid(), note: z.string().trim().max(500).optional().default("") }),
  z.object({ action: z.literal("cancel"), teacherId: z.string().uuid(), reason: z.string().trim().min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(500) }),
]);

function pageNumber(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function addFilters(url: URL, clauses: string[], bindings: unknown[]) {
  const area = url.searchParams.get("area")?.trim();
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  if (area) { clauses.push("t.learning_area_id=?"); bindings.push(area); }
  if (search) {
    clauses.push(`(instr(lower(COALESCE(t.teacher_code,'')),?)>0 OR instr(lower(COALESCE(t.prefix,'')),?)>0 OR
      instr(lower(COALESCE(t.first_name,'')),?)>0 OR instr(lower(COALESCE(t.last_name,'')),?)>0)`);
    bindings.push(search, search, search, search);
  }
}

const statusSql = `CASE WHEN h.status='ACTIVE' THEN 'RECEIVED' WHEN h.status='RETURNED' THEN 'RETURNED' ELSE 'READY' END`;
const baseSql = `FROM teachers t
  LEFT JOIN survey_responses r ON r.teacher_id=t.id
  LEFT JOIN learning_areas a ON a.id=t.learning_area_id
  LEFT JOIN device_assignments d ON d.teacher_id=t.id
  LEFT JOIN teacher_device_handovers h ON h.teacher_id=t.id
  LEFT JOIN admin_users ha ON ha.id=h.handed_over_by
  LEFT JOIN admin_users ra ON ra.id=h.returned_by`;
const eligible = ["t.is_active=1", "r.public_locked=1", "r.decision='ACCEPT'"];

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const db = await ensureDatabase();
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "list";
    if (mode === "lookup") {
      const teacherCode = url.searchParams.get("teacherCode")?.trim();
      if (!teacherCode) return json({ error: "กรุณากรอกรหัสครู" }, 400);
      const row = await db.prepare(`SELECT t.id AS teacher_id,t.teacher_code,t.prefix,t.first_name,t.last_name,
          a.name AS learning_area,d.id AS assignment_id,d.serial_number,d.asset_number,h.status AS handover_record_status,
          ${statusSql} AS handover_status,h.handed_over_at,h.returned_at,h.note,
          ha.display_name AS handed_over_by_name,ra.display_name AS returned_by_name,
          CASE WHEN r.public_locked=1 AND r.decision='ACCEPT' THEN 1 ELSE 0 END AS eligible
        ${baseSql} WHERE t.teacher_code=? AND t.is_active=1 LIMIT 1`)
        .bind(teacherCode).first<Record<string, unknown>>();
      if (!row) return json({ error: "ไม่พบรหัสครูนี้" }, 404);
      const active = row.handover_record_status === "ACTIVE";
      const allowed = row.eligible === 1 && !active;
      return json({ teacher: { ...row, eligible: allowed, eligibilityReason: row.eligible !== 1 ? "ครูยังไม่ได้ลงทะเบียนเลือกรับ iPad" : active ? "ครูรับเครื่องแล้ว" : null } });
    }
    if (mode === "history") {
      const page = pageNumber(url.searchParams.get("page"));
      const clauses = ["1=1"], bindings: unknown[] = [];
      addFilters(url, clauses, bindings);
      const action = url.searchParams.get("action");
      if (action && ["HANDOVER", "RETURN", "CANCEL"].includes(action)) { clauses.push("e.action=?"); bindings.push(action); }
      const where = `WHERE ${clauses.join(" AND ")}`;
      const count = await db.prepare(`SELECT COUNT(*) AS count FROM teacher_device_handover_events e JOIN teachers t ON t.id=e.teacher_id ${where}`).bind(...bindings).first<{count:number}>();
      const rows = await db.prepare(`SELECT e.*,t.teacher_code,t.prefix,t.first_name,t.last_name,a.name AS learning_area,u.display_name AS processed_by_name
        FROM teacher_device_handover_events e JOIN teachers t ON t.id=e.teacher_id
        LEFT JOIN learning_areas a ON a.id=t.learning_area_id LEFT JOIN admin_users u ON u.id=e.processed_by
        ${where} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`).bind(...bindings,PAGE_SIZE,(page-1)*PAGE_SIZE).all();
      return json({ rows: rows.results ?? [], page, pageSize: PAGE_SIZE, total: Number(count?.count ?? 0) });
    }
    const page = pageNumber(url.searchParams.get("page"));
    const baseClauses = [...eligible], baseBindings: unknown[] = [];
    addFilters(url, baseClauses, baseBindings);
    const listClauses = [...baseClauses], listBindings = [...baseBindings];
    const status = url.searchParams.get("status");
    if (status && ["READY", "RECEIVED", "RETURNED"].includes(status)) { listClauses.push(`${statusSql}=?`); listBindings.push(status); }
    const [summary,count,rows,areas] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN ${statusSql}='READY' THEN 1 ELSE 0 END) AS ready,
        SUM(CASE WHEN ${statusSql}='RECEIVED' THEN 1 ELSE 0 END) AS received,SUM(CASE WHEN ${statusSql}='RETURNED' THEN 1 ELSE 0 END) AS returned
        ${baseSql} WHERE ${baseClauses.join(" AND ")}`).bind(...baseBindings).first<Record<string,number|null>>(),
      db.prepare(`SELECT COUNT(*) AS count ${baseSql} WHERE ${listClauses.join(" AND ")}`).bind(...listBindings).first<{count:number}>(),
      db.prepare(`SELECT t.id AS teacher_id,t.teacher_code,t.prefix,t.first_name,t.last_name,a.name AS learning_area,
        d.id AS assignment_id,d.serial_number,d.asset_number,${statusSql} AS handover_status,h.handed_over_at,h.returned_at,h.note,
        ha.display_name AS handed_over_by_name,ra.display_name AS returned_by_name
        ${baseSql} WHERE ${listClauses.join(" AND ")} ORDER BY a.sort_order,t.sort_order,t.first_name,t.last_name LIMIT ? OFFSET ?`)
        .bind(...listBindings,PAGE_SIZE,(page-1)*PAGE_SIZE).all(),
      db.prepare("SELECT id,name FROM learning_areas WHERE is_active=1 ORDER BY sort_order,name").all(),
    ]);
    return json({ rows: rows.results ?? [], areas: areas.results ?? [], page, pageSize: PAGE_SIZE, total:Number(count?.count??0),
      summary:{total:Number(summary?.total??0),ready:Number(summary?.ready??0),received:Number(summary?.received??0),returned:Number(summary?.returned??0)} });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = actionSchema.parse(await request.json());
    const admin = await requireAdminApi(request, input.action === "cancel" ? "superadmin" : undefined);
    const db = await ensureDatabase(), stamp = now();
    if (input.action === "cancel") {
      const current = await db.prepare(`SELECT h.assignment_id,h.serial_number,h.asset_number,t.teacher_code FROM teacher_device_handovers h
        JOIN teachers t ON t.id=h.teacher_id WHERE h.teacher_id=? AND h.status='ACTIVE'`).bind(input.teacherId).first<Record<string,string|null>>();
      if (!current) return json({ error:"ครูยังไม่มีสถานะรับเครื่อง หรือสถานะถูกเปลี่ยนแล้ว" },409);
      const updated = await db.prepare("UPDATE teacher_device_handovers SET status='CANCELLED',updated_at=? WHERE teacher_id=? AND status='ACTIVE'").bind(stamp,input.teacherId).run();
      if (Number(updated.meta.changes??0)===0) return json({error:"สถานะถูกเปลี่ยนโดยผู้ดูแลคนอื่นแล้ว"},409);
      await db.prepare(`INSERT INTO teacher_device_handover_events (id,teacher_id,assignment_id,action,serial_number,asset_number,note,processed_by,created_at)
        VALUES (?,?,?,'CANCEL',?,?,?,?,?)`).bind(id(),input.teacherId,current.assignment_id,current.serial_number,current.asset_number,input.reason,admin.id,stamp).run();
      await audit(db,admin.id,"CANCEL_TEACHER_DEVICE_HANDOVER","teacher_device_handover",input.teacherId,`ยกเลิกสถานะรับเครื่อง รหัสครู ${current.teacher_code}: ${input.reason}`);
      return json({success:true});
    }
    const teacher = await db.prepare(`SELECT t.id,t.teacher_code,t.prefix,t.first_name,t.last_name,d.id AS assignment_id,d.serial_number,d.asset_number,h.status AS handover_status
      FROM teachers t JOIN survey_responses r ON r.teacher_id=t.id LEFT JOIN device_assignments d ON d.teacher_id=t.id
      LEFT JOIN teacher_device_handovers h ON h.teacher_id=t.id
      WHERE t.id=? AND t.is_active=1 AND r.public_locked=1 AND r.decision='ACCEPT'`).bind(input.teacherId).first<Record<string,string|null>>();
    if (!teacher) return json({error:"รับเครื่องได้หลังครูลงทะเบียนเลือกรับ iPad แล้วเท่านั้น"},409);
    if (teacher.handover_status==="ACTIVE") return json({error:"ครูรับเครื่องแล้ว"},409);
    let assignmentId=teacher.assignment_id;
    if (!assignmentId) {
      const proposed=id();
      await db.prepare(`INSERT INTO device_assignments (id,teacher_id,asset_number,serial_number,device_identifier,accessories,note,assigned_at,created_at,updated_at)
        VALUES (?,?,NULL,NULL,NULL,NULL,NULL,?,?,?) ON CONFLICT(teacher_id) DO NOTHING`).bind(proposed,input.teacherId,stamp,stamp,stamp).run();
      const assignment=await db.prepare("SELECT id,serial_number,asset_number FROM device_assignments WHERE teacher_id=?").bind(input.teacherId).first<{id:string;serial_number:string|null;asset_number:string|null}>();
      if(!assignment)return json({error:"ไม่สามารถสร้างรายการจัดสรรเครื่องได้"},409);
      assignmentId=assignment.id;teacher.serial_number=assignment.serial_number;teacher.asset_number=assignment.asset_number;
    }
    await db.prepare("UPDATE device_assignments SET assigned_at=?,updated_at=? WHERE id=?").bind(stamp,stamp,assignmentId).run();
    const updated=await db.prepare(`INSERT INTO teacher_device_handovers
      (teacher_id,assignment_id,status,handed_over_at,handed_over_by,returned_at,returned_by,return_history_id,serial_number,asset_number,note,updated_at)
      VALUES (?,?,'ACTIVE',?,?,NULL,NULL,NULL,?,?,?,?) ON CONFLICT(teacher_id) DO UPDATE SET assignment_id=excluded.assignment_id,status='ACTIVE',
      handed_over_at=excluded.handed_over_at,handed_over_by=excluded.handed_over_by,returned_at=NULL,returned_by=NULL,return_history_id=NULL,
      serial_number=excluded.serial_number,asset_number=excluded.asset_number,note=excluded.note,updated_at=excluded.updated_at
      WHERE teacher_device_handovers.status!='ACTIVE'`).bind(input.teacherId,assignmentId,stamp,admin.id,teacher.serial_number,teacher.asset_number,input.note||null,stamp).run();
    if(Number(updated.meta.changes??0)===0)return json({error:"ครูรับเครื่องแล้ว หรือมีผู้ดูแลบันทึกพร้อมกัน"},409);
    await db.prepare(`INSERT INTO teacher_device_handover_events (id,teacher_id,assignment_id,action,serial_number,asset_number,note,processed_by,created_at)
      VALUES (?,?,?,'HANDOVER',?,?,?,?,?)`).bind(id(),input.teacherId,assignmentId,teacher.serial_number,teacher.asset_number,input.note||null,admin.id,stamp).run();
    await audit(db,admin.id,"TEACHER_DEVICE_HANDOVER","teacher_device_handover",input.teacherId,`บันทึกรับเครื่องของ ${teacher.prefix}${teacher.first_name} ${teacher.last_name} รหัส ${teacher.teacher_code}`);
    return json({success:true});
  } catch(error){return apiError(error);}
}
