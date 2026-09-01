"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBan,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faClock,
  faFileArrowUp,
  faFileCsv,
  faFileExcel,
  faClipboardList,
  faFloppyDisk,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faPrint,
  faRotateRight,
  faSpinner,
  faTabletScreenButton,
  faTrash,
  faUser,
  faUserGraduate,
  faUserTie,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";
import { downloadCsv, readTabularFile, writeXlsxRows, type SpreadsheetRow } from "@/lib/spreadsheet-client";
import { normalizeStudentGrade, normalizeStudentRoom, studentGradeOptions, studentRoomOptions } from "@/lib/data/student-options";
import { isGuardianNameSameAsStudent, parseGuardianFullName } from "@/lib/validation/survey";
import { NDLP_EMAIL_PATTERN, SCHOOL_EMAIL_PATTERN } from "@/lib/validation/email-domains";

type Row = Record<string, unknown>;
type Editor = { id?: string; data: Row; startEditing?: boolean };
const PAGE_SIZE = 50;
const s = (value: unknown) => value == null ? "" : String(value);
const n = (value: unknown) => Number(value ?? 0);
const thaiHeaders: Record<string, string> = {
  "รหัสนักเรียน": "studentCode", "เลขประจำตัวนักเรียน": "studentCode", studentCode: "studentCode",
  "คำนำหน้า": "prefix", prefix: "prefix", "ชื่อ": "firstName", firstName: "firstName",
  "นามสกุล": "lastName", lastName: "lastName", "ชั้น": "gradeLevel", "ระดับชั้น": "gradeLevel", gradeLevel: "gradeLevel",
  "ห้อง": "room", room: "room",
  "วันเกิด": "birthDate", birthDate: "birthDate", "เบอร์โทรศัพท์": "phone", phone: "phone",
  "อีเมลโรงเรียน": "email", email: "email", "อีเมล NDLP": "ndlpEmail", ndlpEmail: "ndlpEmail",
};

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = s(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return text;
  let year = Number(match[3]);
  if (year > 2400) year -= 543;
  return `${year.toString().padStart(4,"0")}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
}

function mapImportRow(row: SpreadsheetRow): Row {
  const mapped: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const target = thaiHeaders[key.trim()];
    if (target) mapped[target] = target === "birthDate" ? normalizeDate(value) : target === "gradeLevel" ? normalizeStudentGrade(value) : target === "room" ? normalizeStudentRoom(value) : s(value).trim();
  }
  return mapped;
}

export function StudentAdmin({ view = "manage" }: { view?: "manage" | "results" }) {
  const resultsView = view === "results";
  const [rows,setRows] = useState<Row[]>([]), [totals,setTotals] = useState<Row>({}), [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false), [search,setSearch] = useState(""), [grade,setGrade] = useState(""), [room,setRoom] = useState(""), [status,setStatus] = useState(""), [approval,setApproval] = useState(""), [editor,setEditor] = useState<Editor|null>(null);
  const [importOpen,setImportOpen] = useState(false), [importRows,setImportRows] = useState<Row[]>([]), [printId,setPrintId] = useState<string|null>(null);
  const [page,setPage] = useState(1);
  const frame = useRef<HTMLIFrameElement>(null);
  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/students"), body = await readJson<{rows:Row[];totals:Row;error?:string}>(response);
      if (!response.ok) throw new Error(body.error);
      setRows(body.rows ?? []); setTotals(body.totals ?? {});
    } catch (error) {
      if (!options.silent) toast.error(error instanceof Error ? error.message : "โหลดข้อมูลนักเรียนไม่สำเร็จ");
    } finally {
      if (!options.silent) setLoading(false);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  useEffect(() => {
    if (!editor && !importOpen && !printId) return;
    const old = document.body.style.overflow; document.body.style.overflow = "hidden";
    const escape = (event:KeyboardEvent) => { if (event.key === "Escape") { setEditor(null); setImportOpen(false); setPrintId(null); } };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = old; window.removeEventListener("keydown", escape); };
  }, [editor,importOpen,printId]);
  async function act(action:string,id?:string,data?:Row,extra?:{rows:Row[]}) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,id,data,...extra})});
      const body = await readJson<{error?:string;inserted?:number;updated?:number;skipped?:number;approvalStatus?:string;approvedAt?:string}>(response);
      if (!response.ok) throw new Error(body.error);
      if (action === "import") toast.success(`นำเข้าสำเร็จ เพิ่ม ${body.inserted??0} แก้ไข ${body.updated??0} ข้าม ${body.skipped??0}`);
      else if (action === "reopen") toast.success("เปิดให้นักเรียนแก้ไขคำตอบแล้ว");
      else if (action === "reset") toast.success("เปิดให้ลงทะเบียนใหม่แล้ว สถานะกลับเป็นยังไม่ลงทะเบียน");
      else if (action === "approve") toast.success("อนุมัติการรับ iPad แล้ว");
      else if (action === "reject") toast.success("บันทึกไม่อนุมัติแล้ว และคืนโควตาเรียบร้อย");
      else toast.success("บันทึกเรียบร้อย");
      if ((action === "approve" || action === "reject") && id && body.approvalStatus) {
        setRows(current => current.map(row => s(row.id) === id ? {
          ...row,
          approval_status: body.approvalStatus,
          approved_at: body.approvedAt ?? new Date().toISOString(),
        } : row));
        void load({ silent: true });
      } else {
        await load();
      }
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ"); return false; }
    finally { setBusy(false); }
  }
  async function exportResults(type:"summary"|"full",format:"csv"|"xlsx") {
    setBusy(true);
    try {
      const params=new URLSearchParams({audience:"students",type});
      const query=search.trim();
      if(query)params.set("search",query);
      if(grade)params.set("grade",grade);
      if(room)params.set("room",room);
      if(status)params.set("decision",status);
      if(approval)params.set("approval",approval);
      const response=await fetch(`/api/admin/export?${params.toString()}`),body=await readJson<{rows:Row[];error?:string}>(response);
      if(!response.ok) throw new Error(body.error);
      const date=new Date().toISOString().slice(0,10),fileName=`student-ipad-survey-${date}.${format}`;
      if(format==="xlsx") await writeXlsxRows(body.rows,fileName); else downloadCsv(body.rows,fileName);
      toast.success(`เตรียมไฟล์ตามตัวกรองแล้ว ${body.rows.length.toLocaleString("th-TH")} รายการ`);
    } catch(error) { toast.error(error instanceof Error?error.message:"ส่งออกข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function openEditor(row:Row) {
    setBusy(true);
    try {
      const response=await fetch(`/api/admin/students?id=${encodeURIComponent(s(row.id))}`), body=await readJson<{student:Row;pii:Row|null;error?:string}>(response);
      if(!response.ok) throw new Error(body.error);
      setEditor({id:s(row.id),data:{...body.student,...(body.pii??{})},startEditing:!resultsView});
    } catch(error) { toast.error(error instanceof Error?error.message:"เปิดข้อมูลนักเรียนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  const grades = useMemo(() => [...new Set(rows.map(row=>s(row.grade_level)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th",{numeric:true})),[rows]);
  const rooms = useMemo(() => [...new Set(rows.filter(row=>!grade||s(row.grade_level)===grade).map(row=>s(row.room)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th",{numeric:true})),[rows,grade]);
  const visibleTotals = useMemo(() => {
    if (!grade && !room) return totals;
    const scopedRows = rows.filter(row => Number(row.is_active) !== 0 && (!grade || s(row.grade_level) === grade) && (!room || s(row.room) === room));
    const responded = scopedRows.filter(row => s(row.survey_status) !== "PENDING").length;
    return {
      total: scopedRows.length,
      responded,
      accepted: scopedRows.filter(row => s(row.survey_status) === "ACCEPT").length,
      declined: scopedRows.filter(row => s(row.survey_status) === "DECLINE").length,
    };
  },[rows,totals,grade,room]);
  const filtered = useMemo(() => {
    const query=search.trim().toLowerCase();
    return rows.filter(row => {
      const approvalStatus=s(row.survey_status)==="ACCEPT"?s(row.approval_status||"PENDING"):"";
      return (!grade || s(row.grade_level)===grade) && (!room || s(row.room)===room) && (!status || s(row.survey_status)===status) && (!approval || approvalStatus===approval) && (!query || [row.student_code,row.prefix,row.first_name,row.last_name,row.room].some(value=>s(value).toLowerCase().includes(query)));
    });
  },[rows,search,grade,room,status,approval]);
  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const currentPage = Math.min(page,totalPages);
  const pagedRows = filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const firstShown = filtered.length ? (currentPage-1)*PAGE_SIZE+1 : 0;
  const lastShown = Math.min(currentPage*PAGE_SIZE,filtered.length);
  const batchPrintUrl = useMemo(() => {
    const params=new URLSearchParams({embed:"1"});
    const query=search.trim();
    if(query)params.set("search",query);
    if(grade)params.set("grade",grade);
    if(room)params.set("room",room);
    if(status)params.set("status",status);
    if(approval)params.set("approval",approval);
    return `/admin/print/student-batch?${params.toString()}`;
  },[search,grade,room,status,approval]);
  return <>
    <div className="admin-topline">
      <div><span className="eyebrow">ระบบจัดการ</span><h1 className="admin-page-title"><FontAwesomeIcon icon={resultsView?faClipboardList:faUserGraduate}/> {resultsView?"ลงทะเบียนนักเรียน":"จัดการนักเรียน"}</h1></div>
      {!resultsView&&<button className="button primary" onClick={()=>setImportOpen(true)}><FontAwesomeIcon icon={faFileArrowUp}/> นำเข้ารายชื่อ</button>}
    </div>
    <div className={`student-admin-kpis${resultsView?" student-results-kpis":""}`}>
      <StudentKpi label="นักเรียนทั้งหมด" value={n(visibleTotals.total)} icon={faUserGraduate} color="#1599d6"/>
      {resultsView?<><StudentKpi label="ลงทะเบียนแล้ว" value={n(visibleTotals.responded)} icon={faCircleCheck} color="#0f9b8e"/><StudentKpi label="รับ iPad" value={n(visibleTotals.accepted)} icon={faTabletScreenButton} color="#12b8c8"/><StudentKpi label="ไม่รับ iPad" value={n(visibleTotals.declined)} icon={faBan} color="#e79b29"/><StudentKpi label="ยังไม่ลงทะเบียน" value={Math.max(0,n(visibleTotals.total)-n(visibleTotals.responded))} icon={faClock} color="#f4b942"/></>:<><StudentKpi label="ลงทะเบียนแล้ว" value={n(visibleTotals.responded)} icon={faCircleCheck} color="#0f9b8e"/><StudentKpi label="รับ iPad" value={n(visibleTotals.accepted)} icon={faTabletScreenButton} color="#12b8c8"/><StudentKpi label="ยังไม่ลงทะเบียน" value={Math.max(0,n(visibleTotals.total)-n(visibleTotals.responded))} icon={faClock} color="#f4b942"/></>}
    </div>
    <section className="admin-panel">
      {resultsView&&<div className="results-table-heading"><div><h2><FontAwesomeIcon icon={faClipboardList}/> รายการลงทะเบียนนักเรียน</h2><p>แสดง {firstShown}-{lastShown} จากผลลัพธ์ {filtered.length} รายการ · ทั้งหมด {rows.length} รายการ</p></div><div className="result-icon-actions"><button className="icon-button csv-action" type="button" disabled={busy} onClick={()=>void exportResults("summary","csv")} aria-label="ดาวน์โหลด Summary CSV" title="ดาวน์โหลด Summary CSV"><FontAwesomeIcon icon={faFileCsv}/></button><button className="icon-button xlsx-action" type="button" disabled={busy} onClick={()=>void exportResults("full","xlsx")} aria-label="ดาวน์โหลด Full XLSX" title="ดาวน์โหลด Full XLSX"><FontAwesomeIcon icon={faFileExcel}/></button><button className="icon-button print-action" type="button" onClick={()=>setPrintId("__batch__")} aria-label="พิมพ์ AWAT-03 แบบชุด" title="พิมพ์ AWAT-03 แบบชุด"><FontAwesomeIcon icon={faPrint}/></button></div></div>}
      <div className="toolbar student-admin-toolbar">
        <div className="toolbar-group student-admin-filters">
          <label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass}/><input value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} placeholder="ค้นหารหัสหรือชื่อนักเรียน..."/></label>
          <select className="admin-input" value={grade} onChange={event=>{setGrade(event.target.value);setRoom("");setPage(1);}} aria-label="กรองตามระดับชั้น"><option value="">ทุกระดับชั้น</option>{grades.map(item=><option key={item}>{item}</option>)}</select>
          <select className="admin-input" value={room} onChange={event=>{setRoom(event.target.value);setPage(1);}} aria-label="กรองตามห้อง"><option value="">ทุกห้อง</option>{rooms.map(item=><option key={item} value={item}>/{item}</option>)}</select>
          {resultsView&&<><select className="admin-input" value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}} aria-label="กรองตามสถานะ"><option value="">ทุกสถานะ</option><option value="ACCEPT">รับ iPad</option><option value="DECLINE">ไม่รับ iPad</option><option value="PENDING">ยังไม่ลงทะเบียน</option></select><select className="admin-input" value={approval} onChange={event=>{setApproval(event.target.value);setPage(1);}} aria-label="กรองผลอนุมัติ"><option value="">ทุกผลอนุมัติ</option><option value="PENDING">รออนุมัติ</option><option value="APPROVED">อนุมัติแล้ว</option><option value="REJECTED">ไม่อนุมัติ</option></select></>}
        </div>
        {!resultsView&&<button className="button secondary" onClick={()=>setEditor({data:{prefix:"เด็กชาย",is_active:1},startEditing:true})}><FontAwesomeIcon icon={faPlus}/> เพิ่มนักเรียน</button>}
      </div>
      {loading ? <div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin/> กำลังโหลดข้อมูล...</div> :
      <div className="admin-table-wrap student-admin-table-wrap"><table className={`admin-table student-admin-table${resultsView?" student-results-table":""}`}><thead><tr><th>รหัสนักเรียน</th><th>ชื่อ-นามสกุล</th><th>ชั้น / ห้อง / เลขที่</th><th>การลงทะเบียน</th>{resultsView&&<><th>ผลอนุมัติ</th><th>วันที่ตอบ</th></>}<th>จัดการ</th></tr></thead>
      <tbody>{pagedRows.map(row=><tr key={s(row.id)} className={Number(row.is_active)===0?"inactive-row":""}><td><b>{s(row.student_code)}</b></td><td>{s(row.prefix)}{s(row.first_name)} {s(row.last_name)}</td><td>{s(row.grade_level)}/{s(row.room)}{s(row.class_number)?` เลขที่ ${s(row.class_number)}`:""}</td><td><Status value={s(row.survey_status)}/></td>{resultsView&&<><td><ApprovalStatus decision={s(row.survey_status)} value={s(row.approval_status)}/></td><td>{row.submitted_at?new Date(s(row.submitted_at)).toLocaleString("th-TH"):"—"}</td></>}<td><div className="table-actions">
        {resultsView&&s(row.survey_status)==="ACCEPT"&&s(row.approval_status)!=="APPROVED"&&<button className="icon-button approval-approve-button" title="อนุมัติการรับ iPad" aria-label="อนุมัติการรับ iPad" disabled={busy} onClick={()=>void act("approve",s(row.id))}><FontAwesomeIcon icon={faCircleCheck}/></button>}
        {resultsView&&s(row.survey_status)==="ACCEPT"&&s(row.approval_status)!=="REJECTED"&&<button className="icon-button approval-reject-button" title="ไม่อนุมัติการรับ iPad" aria-label="ไม่อนุมัติการรับ iPad" disabled={busy} onClick={()=>{if(confirm(`ยืนยันไม่อนุมัติการรับ iPad ของ ${s(row.first_name)} ${s(row.last_name)} หรือไม่`))void act("reject",s(row.id));}}><FontAwesomeIcon icon={faBan}/></button>}
        <button className="icon-button" title={resultsView?"ดูรายละเอียด":"แก้ไขข้อมูลนักเรียน"} aria-label={resultsView?"ดูรายละเอียด":"แก้ไขข้อมูลนักเรียน"} onClick={()=>void openEditor(row)}><FontAwesomeIcon icon={resultsView?faUser:faPen}/></button>
        {s(row.survey_status)==="ACCEPT"&&<button className="icon-button" title="พิมพ์ AWAT-03" aria-label="พิมพ์ AWAT-03" onClick={()=>setPrintId(s(row.id))}><FontAwesomeIcon icon={faPrint}/></button>}
        {s(row.survey_status)!=="PENDING"&&<button className="icon-button" title="เปิดให้ตอบใหม่" aria-label="เปิดให้ตอบใหม่" onClick={()=>void act("reopen",s(row.id))}><FontAwesomeIcon icon={faRotateRight}/></button>}
        {!resultsView&&<button className="icon-button danger-icon-button" title="ลบหรือปิดใช้งาน" aria-label="ลบหรือปิดใช้งาน" onClick={()=>{if(confirm(`ลบหรือปิดใช้งาน ${s(row.first_name)} ${s(row.last_name)} หรือไม่`)) void act("delete",s(row.id));}}><FontAwesomeIcon icon={faTrash}/></button>}
      </div></td></tr>)}</tbody></table>{!filtered.length&&<div className="empty-state small">{resultsView?"ไม่พบรายการลงทะเบียนนักเรียน":"ไม่พบข้อมูลนักเรียน"}</div>}{filtered.length>PAGE_SIZE&&<nav className="table-pagination" aria-label="เปลี่ยนหน้ารายการนักเรียน"><span>แถว {firstShown}-{lastShown} จาก {filtered.length.toLocaleString("th-TH")}</span><div><button type="button" disabled={currentPage===1} onClick={()=>setPage(value=>Math.max(1,value-1))} aria-label="หน้าก่อนหน้า"><FontAwesomeIcon icon={faChevronLeft}/></button><b>หน้า {currentPage.toLocaleString("th-TH")} / {totalPages.toLocaleString("th-TH")}</b><button type="button" disabled={currentPage===totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))} aria-label="หน้าถัดไป"><FontAwesomeIcon icon={faChevronRight}/></button></div></nav>}</div>}
    </section>
    {editor&&<StudentEditor value={editor} busy={busy} close={()=>setEditor(null)} print={editor.id&&s(editor.data.decision)==="ACCEPT"&&Number(editor.data.public_locked)===1?()=>{setEditor(null);setPrintId(editor.id!)}:undefined} reopen={editor.id&&editor.data.response_id&&Number(editor.data.public_locked)===1?async()=>{if(await act("reopen",editor.id))setEditor(null)}:undefined} reset={editor.id&&editor.data.response_id?async()=>{if(confirm(`ยืนยันเปิดให้ ${s(editor.data.first_name)} ${s(editor.data.last_name)} ลงทะเบียนใหม่หรือไม่ ข้อมูลการลงทะเบียนเดิมจะถูกลบ`)&&await act("reset",editor.id))setEditor(null)}:undefined} save={async data=>{if(await act(editor.id?"save-detail":"save",editor.id,data)) setEditor(null);}}/>}
    {importOpen && (
      <StudentImport
        rows={importRows}
        busy={busy}
        setRows={setImportRows}
        close={() => {
          setImportOpen(false);
          setImportRows([]);
        }}
        submit={async () => {
          if (await act("import", undefined, undefined, { rows: importRows })) {
            setImportOpen(false);
            setImportRows([]);
          }
        }}
      />
    )}
    {printId&&<div className="modal-backdrop print-preview-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setPrintId(null)}}><section className="modal print-preview-modal" onMouseDown={event=>event.stopPropagation()}><header className="print-preview-header"><div><span className="eyebrow">ตัวอย่างเอกสารนักเรียน</span><h2>{printId==="__batch__"?"แบบฟอร์ม AWAT-03 นักเรียนแบบชุด":"แบบฟอร์ม AWAT-03"}</h2></div><div className="print-preview-actions"><button className="button primary" onClick={()=>frame.current?.contentWindow?.print()}><FontAwesomeIcon icon={faPrint}/> พิมพ์เอกสาร</button><button className="icon-button" onClick={()=>setPrintId(null)} aria-label="ปิด"><FontAwesomeIcon icon={faXmark}/></button></div></header><iframe ref={frame} title={printId==="__batch__"?"ตัวอย่าง AWAT-03 นักเรียนแบบชุด":"ตัวอย่าง AWAT-03 นักเรียน"} src={printId==="__batch__"?batchPrintUrl:`/admin/print/student/${printId}?embed=1`}/></section></div>}
  </>;
}

function StudentKpi({label,value,icon,color}:{label:string;value:number;icon:IconDefinition;color:string}) { return <div className="kpi"><div className="kpi-top"><span>{label}</span><span className="kpi-icon" style={{color,background:`${color}18`}}><FontAwesomeIcon icon={icon}/></span></div><b>{value}</b><i style={{background:color}}/></div>; }
function Status({value}:{value:string}) {
  const text=value==="ACCEPT"?"รับ iPad":value==="DECLINE"?"ไม่รับ iPad":"ยังไม่ลงทะเบียน";
  const cls=value==="ACCEPT"?"accept":value==="DECLINE"?"decline":"pending";
  const icon=value==="ACCEPT"?faCircleCheck:value==="DECLINE"?faBan:faClock;
  return <span className={`badge ${cls}`}><FontAwesomeIcon icon={icon}/>{text}</span>;
}
function ApprovalStatus({decision,value}:{decision:string;value:string}) {
  if(decision!=="ACCEPT")return <span className="badge pending" title="ไม่เกี่ยวข้อง"><FontAwesomeIcon icon={faBan}/>—</span>;
  const status=value||"PENDING";
  const text=status==="APPROVED"?"อนุมัติแล้ว":status==="REJECTED"?"ไม่อนุมัติ":"รออนุมัติ";
  const cls=status==="APPROVED"?"approved":status==="REJECTED"?"rejected":"awaiting";
  const icon=status==="APPROVED"?faCircleCheck:status==="REJECTED"?faBan:faClock;
  return <span className={`badge ${cls}`}><FontAwesomeIcon icon={icon}/>{text}</span>;
}
function StudentEditor({value,busy,close,save,print,reopen,reset}:{value:Editor;busy:boolean;close:()=>void;save:(data:Row)=>Promise<void>;print?:()=>void;reopen?:()=>Promise<void>;reset?:()=>Promise<void>}) {
  const initial=value.data;
  const hasAwat=s(initial.decision)==="ACCEPT";
  const gradeValue=normalizeStudentGrade(initial.grade_level);
  const roomValue=normalizeStudentRoom(initial.room);
  const [editing,setEditing]=useState(value.startEditing??!value.id);
  async function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault(); const fd=new FormData(event.currentTarget),data=Object.fromEntries(fd); if(hasAwat){const guardian=parseGuardianFullName(s(data.guardianFullName));if(!guardian){toast.warning("กรุณากรอกชื่อผู้ปกครองพร้อมคำนำหน้า นาย นาง หรือนางสาว");return;}if(isGuardianNameSameAsStudent(guardian.name,`${s(data.firstName)} ${s(data.lastName)}`)){toast.warning("ชื่อผู้ปกครองต้องไม่เป็นชื่อเดียวกับนักเรียน กรุณาตรวจสอบอีกครั้ง");return;}data.guardianPrefix=guardian.prefix;data.guardianName=guardian.name;delete data.guardianFullName;} await save(data); }
  const fullName=`${s(initial.prefix)}${s(initial.first_name)} ${s(initial.last_name)}`.trim();
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close()}}><section className="modal teacher-editor-modal editor-modal student-editor-modal" onMouseDown={event=>event.stopPropagation()}><header className="student-editor-header"><div className="student-editor-title"><span><FontAwesomeIcon icon={faUserGraduate}/></span><div><small>{!value.id?"เพิ่มรายชื่อใหม่":editing?"แก้ไขข้อมูลเดิม":"ข้อมูลนักเรียนและการลงทะเบียน"}</small><h2>{!value.id?"เพิ่มนักเรียน":editing?"แก้ไขข้อมูลนักเรียน":fullName}</h2></div></div><button className="icon-button" onClick={close} aria-label="ปิด"><FontAwesomeIcon icon={faXmark}/></button></header>{editing?<form onSubmit={submit} className="admin-form-grid student-editor-form">
    {value.id&&<div className="student-editor-advisor full"><span><FontAwesomeIcon icon={faUserTie}/></span><div><small>ครูที่ปรึกษา</small><b>{s(initial.advisor_name)||"ยังไม่ได้กำหนดครูที่ปรึกษา"}</b></div></div>}
    <label className="field"><span>คำนำหน้า <b>*</b></span><select name="prefix" defaultValue={s(initial.prefix)||"เด็กชาย"}><option>เด็กชาย</option><option>เด็กหญิง</option><option>นาย</option><option>นางสาว</option></select></label>
    <label className="field"><span>ชื่อ <b>*</b></span><input name="firstName" defaultValue={s(initial.first_name)} required/></label>
    <label className="field"><span>นามสกุล <b>*</b></span><input name="lastName" defaultValue={s(initial.last_name)} required/></label>
    <label className="field"><span>รหัสนักเรียน <b>*</b></span><input name="studentCode" defaultValue={s(initial.student_code)} required/></label>
    <label className="field"><span>ระดับชั้น <b>*</b></span><select name="gradeLevel" defaultValue={gradeValue} required><option value="" disabled>เลือกระดับชั้น</option>{studentGradeOptions.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
    <label className="field"><span>ห้อง <b>*</b></span><select name="room" defaultValue={roomValue} required><option value="" disabled>เลือกห้อง</option>{studentRoomOptions.map(item=><option key={item} value={item}>/{item}</option>)}</select></label>
    <label className="field"><span>เลขที่ <small>ระบบจัดให้อัตโนมัติ</small></span><input value={s(initial.class_number)} placeholder="จัดหลังบันทึก" disabled readOnly/></label>
    <label className="field"><span>วันเกิด <small>ไม่ใช้ยืนยันตัวตน</small></span><input type="date" name="birthDate" defaultValue={s(initial.birth_date)}/></label>
    <label className="field"><span>เบอร์โทรศัพท์นักเรียน</span><input name="phone" inputMode="tel" maxLength={10} defaultValue={s(initial.phone)}/></label>
    <label className="field"><span>อีเมลโรงเรียน</span><input type="email" name="email" pattern={SCHOOL_EMAIL_PATTERN} title="ต้องใช้อีเมล @chomthong.ac.th" placeholder="name@chomthong.ac.th" defaultValue={s(initial.school_email)}/></label>
    <label className="field"><span>อีเมล NDLP</span><input type="email" name="ndlpEmail" pattern={NDLP_EMAIL_PATTERN} title="ต้องใช้อีเมล @ndlp.go.th" placeholder="name@ndlp.go.th" defaultValue={s(initial.ndlp_email)}/><small className="field-hint">หากลืมอีเมล NDLP ให้ติดต่อครูวิทยา หรือครูธนา</small></label>
    {hasAwat&&<label className="field"><span>Serial Number <small>{s(initial.approval_status)==="APPROVED"?"แก้ไขได้":"แก้ไขได้หลังอนุมัติ"}</small></span><input name={s(initial.approval_status)==="APPROVED"?"serialNumber":undefined} defaultValue={s(initial.serial_number)} disabled={s(initial.approval_status)!=="APPROVED"}/></label>}
    {hasAwat&&<>
      <div className="student-awat-editor-heading full"><span className="eyebrow">ข้อมูลตามแบบฟอร์ม AWAT-03</span><h3>ข้อมูลผู้ยืม ผู้ปกครอง และที่อยู่ตามทะเบียนบ้าน</h3><p>ข้อมูลส่วนนี้ถูกเข้ารหัสและใช้สำหรับออกเอกสาร AWAT-03 นักเรียน</p></div>
      <label className="field"><span>เลขประจำตัวประชาชน / รหัส G <b>*</b></span><input name="citizenId" inputMode="text" autoCapitalize="characters" maxLength={13} placeholder="เลข 13 หลัก หรือ G ตามด้วยเลข 12 หลัก" defaultValue={s(initial.citizenId)} required/><small className="field-hint">รองรับเลขคนไทย รหัส G และเลขบุคคลไม่มีสัญชาติไทยที่ขึ้นต้นด้วย 0</small></label>
      <label className="field student-guardian-name"><span>ชื่อ-นามสกุลผู้ปกครอง (รวมคำนำหน้า) <b>*</b></span><input name="guardianFullName" defaultValue={`${s(initial.guardianPrefix)}${s(initial.guardianName)}`} pattern="^(นาย|นางสาว|นาง)\s*.+$" title="กรุณาขึ้นต้นด้วย นาย นาง หรือนางสาว" placeholder="เช่น นางสาวสมใจ ใจดี" required/></label>
      <label className="field"><span>เบอร์โทรศัพท์ผู้ปกครอง <b>*</b></span><input name="guardianPhone" inputMode="tel" maxLength={10} defaultValue={s(initial.guardianPhone)} required/></label>
      <label className="field"><span>บ้านเลขที่ <b>*</b></span><input name="houseNo" defaultValue={s(initial.houseNo)} required/></label>
      <label className="field"><span>หมู่</span><input name="moo" defaultValue={s(initial.moo)}/></label>
      <label className="field"><span>ซอย</span><input name="soi" defaultValue={s(initial.soi)}/></label>
      <label className="field"><span>ถนน</span><input name="road" defaultValue={s(initial.road)}/></label>
      <label className="field"><span>ตำบล/แขวง <b>*</b></span><input name="subdistrict" defaultValue={s(initial.subdistrict)} required/></label>
      <label className="field"><span>อำเภอ/เขต <b>*</b></span><input name="district" defaultValue={s(initial.district)} required/></label>
      <label className="field"><span>จังหวัด <b>*</b></span><input name="province" defaultValue={s(initial.province)} required/></label>
      <label className="field"><span>รหัสไปรษณีย์ <b>*</b></span><input name="postalCode" inputMode="numeric" maxLength={5} defaultValue={s(initial.postalCode)} required/></label>
    </>}
    <div className="modal-actions full"><button type="button" className="button secondary" onClick={()=>value.id?setEditing(false):close()}>ยกเลิก</button><button className="button primary" disabled={busy}><FontAwesomeIcon icon={busy?faSpinner:faFloppyDisk} spin={busy}/> บันทึก</button></div>
  </form>:<div className="student-registration-detail">
    <div className="student-registration-summary">
      <span><FontAwesomeIcon icon={faUserGraduate}/></span>
      <div><small>ผู้ลงทะเบียน</small><h3>{fullName}</h3><p>รหัสนักเรียน {s(initial.student_code)} · {s(initial.grade_level)}/{s(initial.room)}{s(initial.class_number)?` · เลขที่ ${s(initial.class_number)}`:""}</p></div>
    </div>
    <div className="student-registration-detail-grid">
      <StudentDetailInfo label="สถานะการลงทะเบียน"><Status value={s(initial.decision)||"PENDING"}/></StudentDetailInfo>
      <StudentDetailInfo label="ผลอนุมัติ"><ApprovalStatus decision={s(initial.decision)} value={s(initial.approval_status)}/></StudentDetailInfo>
      <StudentDetailInfo label="วันที่ตอบ">{initial.submitted_at?new Date(s(initial.submitted_at)).toLocaleString("th-TH"):"—"}</StudentDetailInfo>
      <StudentDetailInfo label="ครูที่ปรึกษา">{s(initial.advisor_name)||"ยังไม่ได้กำหนด"}</StudentDetailInfo>
      <StudentDetailInfo label="เบอร์โทรศัพท์นักเรียน">{s(initial.phone)||"—"}</StudentDetailInfo>
      <StudentDetailInfo label="อีเมลโรงเรียน">{s(initial.school_email)||"—"}</StudentDetailInfo>
      <StudentDetailInfo label="อีเมล NDLP">{s(initial.ndlp_email)||"—"}</StudentDetailInfo>
      {hasAwat&&<StudentDetailInfo label="Serial Number">{s(initial.serial_number)||"ยังไม่ได้บันทึก"}</StudentDetailInfo>}
      {hasAwat&&<StudentDetailInfo label="เลขประจำตัวประชาชน">{s(initial.citizenId)||"—"}</StudentDetailInfo>}
      {hasAwat&&<StudentDetailInfo label="ผู้ปกครอง">{`${s(initial.guardianPrefix)}${s(initial.guardianName)}`.trim()||"—"}</StudentDetailInfo>}
      {hasAwat&&<StudentDetailInfo label="เบอร์โทรศัพท์ผู้ปกครอง">{s(initial.guardianPhone)||"—"}</StudentDetailInfo>}
      {hasAwat&&<StudentDetailInfo label="ที่อยู่ตามทะเบียนบ้าน" wide>{[s(initial.houseNo),s(initial.moo)&&`หมู่ ${s(initial.moo)}`,s(initial.soi)&&`ซอย ${s(initial.soi)}`,s(initial.road)&&`ถนน ${s(initial.road)}`,s(initial.subdistrict)&&`ต.${s(initial.subdistrict)}`,s(initial.district)&&`อ.${s(initial.district)}`,s(initial.province)&&`จ.${s(initial.province)}`,s(initial.postalCode)].filter(Boolean).join(" ")||"—"}</StudentDetailInfo>}
    </div>
    <div className="student-registration-detail-actions">
      <button className="button primary" type="button" onClick={()=>setEditing(true)}><FontAwesomeIcon icon={faPen}/> แก้ไขข้อมูล</button>
      {print&&<button className="button secondary" type="button" onClick={print}><FontAwesomeIcon icon={faPrint}/> พิมพ์ AWAT03</button>}
      {reopen&&<button className="button secondary" type="button" disabled={busy} onClick={()=>void reopen()}><FontAwesomeIcon icon={faRotateRight}/> เปิดให้นักเรียนแก้ไข</button>}
      {reset&&<button className="button danger" type="button" disabled={busy} onClick={()=>void reset()}><FontAwesomeIcon icon={faTrash}/> เปิดให้ลงทะเบียนใหม่</button>}
    </div>
  </div>}</section></div>;
}

function StudentDetailInfo({label,children,wide=false}:{label:string;children:ReactNode;wide?:boolean}) {
  return <div className={`student-registration-detail-item${wide?" wide":""}`}><small>{label}</small><div>{children}</div></div>;
}

function StudentImport({rows,busy,setRows,close,submit}:{rows:Row[];busy:boolean;setRows:(rows:Row[])=>void;close:()=>void;submit:()=>Promise<void>}) {
  async function choose(file?:File) { if(!file)return; try { const parsed=(await readTabularFile(file)).map(mapImportRow); setRows(parsed); toast.success(`อ่านข้อมูล ${parsed.length} รายการ`); } catch { toast.error("อ่านไฟล์ไม่สำเร็จ กรุณาตรวจรูปแบบไฟล์"); } }
  async function template() { await writeXlsxRows([{ "รหัสนักเรียน":"12345","คำนำหน้า":"เด็กชาย","ชื่อ":"ตัวอย่าง","นามสกุล":"นักเรียน","ชั้น":"มัธยมศึกษาปีที่ 1","ห้อง":"1","วันเกิด":"","เบอร์โทรศัพท์":"","อีเมลโรงเรียน":"","อีเมล NDLP":"" }],"student-import-template.xlsx"); }
  return <div className="modal-backdrop import-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close()}}><section className="modal import-modal student-import-modal" onMouseDown={event=>event.stopPropagation()}><div className="toolbar dialog-title"><div><span className="eyebrow">IMPORT STUDENTS</span><h2><FontAwesomeIcon icon={faFileExcel}/> นำเข้ารายชื่อนักเรียน</h2><p>รองรับ Excel และ CSV โดยใช้หัวคอลัมน์ภาษาไทยตามเทมเพลต</p></div><button className="icon-button" onClick={close} aria-label="ปิด"><FontAwesomeIcon icon={faXmark}/></button></div><div className="student-import-actions"><button className="button secondary" onClick={()=>void template()}><FontAwesomeIcon icon={faFileExcel}/> ดาวน์โหลดเทมเพลต</button><label className="button primary"><FontAwesomeIcon icon={faFileArrowUp}/> เลือกไฟล์<input type="file" hidden accept=".xlsx,.csv" onChange={event=>void choose(event.target.files?.[0])}/></label></div>
    {rows.length?<><div className="import-summary">ตรวจพบ <b>{rows.length}</b> รายการ ระบบจะข้ามแถวที่รหัส ชื่อ ชั้น หรือห้องไม่ครบ</div><div className="admin-table-wrap student-import-preview"><table className="admin-table"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ชั้น/ห้อง</th><th>วันเกิด</th></tr></thead><tbody>{rows.slice(0,20).map((row,index)=><tr key={index}><td>{s(row.studentCode)}</td><td>{s(row.prefix)}{s(row.firstName)} {s(row.lastName)}</td><td>{s(row.gradeLevel)}/{s(row.room)}</td><td>{s(row.birthDate)||"—"}</td></tr>)}</tbody></table></div><div className="modal-actions"><button className="button secondary" onClick={close}>ยกเลิก</button><button className="button primary" disabled={busy} onClick={()=>void submit()}><FontAwesomeIcon icon={busy?faSpinner:faFloppyDisk} spin={busy}/> ยืนยันนำเข้า</button></div></>:<div className="drop-zone"><FontAwesomeIcon icon={faFileExcel}/><h3>เลือกไฟล์รายชื่อนักเรียน</h3><p>วันเกิดไม่บังคับ ระบบใช้เลขประจำตัวนักเรียนในการค้นหา</p></div>}
  </section></div>;
}
