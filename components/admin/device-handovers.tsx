"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan, faCheck, faChevronLeft, faChevronRight, faCircleCheck, faClock,
  faFileCircleCheck, faHistory, faMagnifyingGlass, faRotateLeft, faSchool,
  faSpinner, faTabletScreenButton, faUserGraduate, faUsers, faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";

type Row = Record<string, unknown>;
type Tab = "QUICK" | "ROOM" | "HISTORY";
type RecipientType = "STUDENT" | "GUARDIAN" | "OTHER";
type Summary = { total:number; notReady:number; ready:number; received:number; returned:number };
type Option = { grade_level:string; room:string };
const PAGE_SIZE = 50;
const text = (value:unknown) => value == null ? "" : String(value);

function formatDateTime(value:unknown) {
  const raw=text(value); if(!raw)return "—";
  const date=new Date(raw); if(Number.isNaN(date.getTime()))return raw;
  return date.toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"});
}

function StudentName({row}:{row:Row}) { return <>{text(row.prefix)}{text(row.first_name)} {text(row.last_name)}</>; }

const statusDetails:Record<string,{label:string;icon:typeof faClock}>={
  NOT_READY:{label:"เอกสารยังไม่พร้อม",icon:faFileCircleCheck},
  READY:{label:"พร้อมรับเครื่อง",icon:faClock},
  RECEIVED:{label:"รับเครื่องแล้ว",icon:faCircleCheck},
  RETURNED:{label:"คืนเครื่องแล้ว",icon:faRotateLeft},
};

function HandoverStatus({row}:{row:Row}) {
  const status=text(row.handover_status)||"NOT_READY",detail=statusDetails[status]??statusDetails.NOT_READY;
  return <span className={`handover-status ${status.toLowerCase()}`}><FontAwesomeIcon icon={detail.icon}/>{detail.label}</span>;
}

function Recipient({row}:{row:Row}) {
  const type=text(row.recipient_type);
  if(type==="GUARDIAN")return <>ผู้ปกครอง{text(row.recipient_name)?` · ${text(row.recipient_name)}`:""}</>;
  if(type==="OTHER")return <>ผู้รับแทน{text(row.recipient_name)?` · ${text(row.recipient_name)}`:""}</>;
  return <>นักเรียนรับเอง</>;
}

export function DeviceHandovers({canCancel}:{canCancel:boolean}) {
  const [tab,setTab]=useState<Tab>("QUICK"),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [rows,setRows]=useState<Row[]>([]),[historyRows,setHistoryRows]=useState<Row[]>([]),[options,setOptions]=useState<Option[]>([]);
  const [summary,setSummary]=useState<Summary>({total:0,notReady:0,ready:0,received:0,returned:0});
  const [total,setTotal]=useState(0),[historyTotal,setHistoryTotal]=useState(0),[page,setPage]=useState(1);
  const [search,setSearch]=useState(""),[grade,setGrade]=useState(""),[room,setRoom]=useState(""),[status,setStatus]=useState(""),[historyAction,setHistoryAction]=useState("");
  const [studentCode,setStudentCode]=useState(""),[quickStudent,setQuickStudent]=useState<Row|null>(null);
  const [quickRecipientType,setQuickRecipientType]=useState<RecipientType>("STUDENT"),[quickRecipientName,setQuickRecipientName]=useState(""),[quickNote,setQuickNote]=useState("");
  const [handoverTarget,setHandoverTarget]=useState<Row|null>(null),[cancelTarget,setCancelTarget]=useState<Row|null>(null);
  const codeInput=useRef<HTMLInputElement>(null);
  const grades=useMemo(()=>[...new Set(options.map(item=>text(item.grade_level)).filter(Boolean))],[options]);
  const rooms=useMemo(()=>[...new Set(options.filter(item=>!grade||text(item.grade_level)===grade).map(item=>text(item.room)).filter(Boolean))],[options,grade]);
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE)),historyPages=Math.max(1,Math.ceil(historyTotal/PAGE_SIZE));
  const quickReady=Boolean(quickStudent&&quickStudent.eligible===true&&text(quickStudent.student_code)===studentCode.trim());

  function params(mode:"list"|"history") {
    const value=new URLSearchParams({mode,page:String(page)});
    if(search.trim())value.set("search",search.trim()); if(grade)value.set("grade",grade); if(room)value.set("room",room);
    if(mode==="list"&&status)value.set("status",status); if(mode==="history"&&historyAction)value.set("action",historyAction);
    return value;
  }
  async function loadList(silent=false) {
    if(!silent)setLoading(true);
    try { const response=await fetch(`/api/admin/device-handovers?${params("list")}`,{cache:"no-store"}),body=await readJson<{rows?:Row[];summary?:Summary;options?:Option[];total?:number;error?:string}>(response); if(!response.ok)throw new Error(body.error); setRows(body.rows??[]);setSummary(body.summary??{total:0,notReady:0,ready:0,received:0,returned:0});setOptions(body.options??[]);setTotal(Number(body.total??0)); }
    catch(error){if(!silent)toast.error(error instanceof Error?error.message:"โหลดสถานะรับเครื่องไม่สำเร็จ");}finally{if(!silent)setLoading(false);}
  }
  async function loadHistory(silent=false) {
    if(!silent)setLoading(true);
    try { const response=await fetch(`/api/admin/device-handovers?${params("history")}`,{cache:"no-store"}),body=await readJson<{rows?:Row[];total?:number;error?:string}>(response);if(!response.ok)throw new Error(body.error);setHistoryRows(body.rows??[]);setHistoryTotal(Number(body.total??0)); }
    catch(error){if(!silent)toast.error(error instanceof Error?error.message:"โหลดประวัติรับเครื่องไม่สำเร็จ");}finally{if(!silent)setLoading(false);}
  }
  useEffect(()=>{const timer=window.setTimeout(()=>{if(tab==="HISTORY")void loadHistory();else void loadList();},search?250:0);return()=>window.clearTimeout(timer);// eslint-disable-next-line react-hooks/exhaustive-deps
  },[tab,page,search,grade,room,status,historyAction]);
  useEffect(()=>{if(!handoverTarget&&!cancelTarget)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous;};},[handoverTarget,cancelTarget]);

  function changeTab(next:Tab){setTab(next);setPage(1);setSearch("");setGrade("");setRoom("");setStatus("");setHistoryAction("");if(next==="QUICK")window.setTimeout(()=>codeInput.current?.focus(),0);}
  async function lookup(event:FormEvent){event.preventDefault();if(busy)return;const code=studentCode.trim();if(!code){toast.warning("กรุณากรอกเลขประจำตัวนักเรียน");return;}if(quickReady&&quickStudent){await handover(quickStudent,quickRecipientType,quickRecipientName,quickNote,true);return;}setBusy(true);setQuickStudent(null);try{const query=new URLSearchParams({mode:"lookup",studentCode:code}),response=await fetch(`/api/admin/device-handovers?${query}`,{cache:"no-store"}),body=await readJson<{student?:Row;error?:string}>(response);if(!response.ok)throw new Error(body.error);setQuickStudent(body.student??null);}catch(error){toast.error(error instanceof Error?error.message:"ค้นหานักเรียนไม่สำเร็จ");}finally{setBusy(false);}}
  async function handover(row:Row,recipientType:RecipientType,recipientName:string,note:string,quick=false){if(recipientType!=="STUDENT"&&recipientName.trim().length<2){toast.warning("กรุณาระบุชื่อผู้ปกครองหรือผู้รับแทน");return;}setBusy(true);try{const response=await fetch("/api/admin/device-handovers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"handover",studentId:text(row.student_id),recipientType,recipientName,note})}),body=await readJson<{error?:string}>(response);if(!response.ok)throw new Error(body.error);toast.success("บันทึกรับเครื่องเรียบร้อยแล้ว");setHandoverTarget(null);if(quick){setQuickStudent(null);setStudentCode("");setQuickRecipientType("STUDENT");setQuickRecipientName("");setQuickNote("");window.setTimeout(()=>codeInput.current?.focus(),0);}await Promise.all([loadList(true),loadHistory(true)]);}catch(error){toast.error(error instanceof Error?error.message:"บันทึกรับเครื่องไม่สำเร็จ");}finally{setBusy(false);}}
  async function cancel(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!cancelTarget)return;const reason=text(new FormData(event.currentTarget).get("reason")).trim();setBusy(true);try{const response=await fetch("/api/admin/device-handovers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"cancel",studentId:text(cancelTarget.student_id),reason})}),body=await readJson<{error?:string}>(response);if(!response.ok)throw new Error(body.error);toast.success("ยกเลิกสถานะรับเครื่องแล้ว");setCancelTarget(null);setQuickStudent(null);await Promise.all([loadList(true),loadHistory(true)]);}catch(error){toast.error(error instanceof Error?error.message:"ยกเลิกสถานะไม่สำเร็จ");}finally{setBusy(false);}}

  return <>
    <div className="admin-topline document-checkin-topline"><div><span className="eyebrow">ระบบจัดการอุปกรณ์</span><h1 className="admin-page-title"><FontAwesomeIcon icon={faTabletScreenButton}/> สถานะการรับเครื่อง</h1><p>ตรวจสอบผู้ที่พร้อมรับ บันทึกการส่งมอบ และเชื่อมสถานะกับการคืน iPad</p></div></div>
    <div className="handover-summary-grid">
      <article><span><FontAwesomeIcon icon={faUsers}/></span><div><small>ผ่านการอนุมัติ</small><b>{summary.total.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
      <article className="not-ready"><span><FontAwesomeIcon icon={faFileCircleCheck}/></span><div><small>เอกสารยังไม่พร้อม</small><b>{summary.notReady.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
      <article className="ready"><span><FontAwesomeIcon icon={faClock}/></span><div><small>พร้อมรับเครื่อง</small><b>{summary.ready.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
      <article className="received"><span><FontAwesomeIcon icon={faCircleCheck}/></span><div><small>รับเครื่องแล้ว</small><b>{summary.received.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
      <article className="returned"><span><FontAwesomeIcon icon={faRotateLeft}/></span><div><small>คืนเครื่องแล้ว</small><b>{summary.returned.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
    </div>
    <section className="admin-panel document-checkin-panel">
      <div className="document-checkin-tabs" role="tablist" aria-label="รูปแบบตรวจสถานะรับเครื่อง">
        <button type="button" role="tab" aria-selected={tab==="QUICK"} className={tab==="QUICK"?"active":""} onClick={()=>changeTab("QUICK")}><FontAwesomeIcon icon={faUserGraduate}/><span>เช็คด่วน</span></button>
        <button type="button" role="tab" aria-selected={tab==="ROOM"} className={tab==="ROOM"?"active":""} onClick={()=>changeTab("ROOM")}><FontAwesomeIcon icon={faSchool}/><span>ตรวจรายห้อง</span></button>
        <button type="button" role="tab" aria-selected={tab==="HISTORY"} className={tab==="HISTORY"?"active":""} onClick={()=>changeTab("HISTORY")}><FontAwesomeIcon icon={faHistory}/><span>ประวัติ</span></button>
      </div>
      {tab==="QUICK"&&<div className="document-quick-layout">
        <div className="document-quick-entry"><span className="document-quick-icon"><FontAwesomeIcon icon={faMagnifyingGlass}/></span><div><h2>บันทึกรับเครื่องแบบรวดเร็ว</h2><p>{quickReady?"ตรวจสอบชื่อแล้วกด Enter อีกครั้งเพื่อยืนยัน":"กรอกเลขประจำตัวแล้วกด Enter เพื่อค้นหา"}</p></div><form onSubmit={lookup}><label className="field"><span>เลขประจำตัวนักเรียน</span><input ref={codeInput} autoFocus inputMode="numeric" autoComplete="off" value={studentCode} onChange={event=>{const next=event.target.value;setStudentCode(next);if(quickStudent&&text(quickStudent.student_code)!==next.trim())setQuickStudent(null);}} placeholder="เช่น 23964"/></label><button className="button primary" disabled={busy}><FontAwesomeIcon icon={busy?faSpinner:quickReady?faCheck:faMagnifyingGlass} spin={busy}/>{busy?"กำลังดำเนินการ...":quickReady?"ยืนยันรับเครื่อง":"ตรวจสอบ"}</button></form>
          {quickReady&&<div className="handover-quick-options"><label className="field"><span>ผู้มารับ</span><select value={quickRecipientType} onChange={event=>setQuickRecipientType(event.target.value as RecipientType)}><option value="STUDENT">นักเรียนรับเอง</option><option value="GUARDIAN">ผู้ปกครอง</option><option value="OTHER">ผู้รับแทน</option></select></label>{quickRecipientType!=="STUDENT"&&<label className="field"><span>ชื่อผู้มารับ <b>*</b></span><input value={quickRecipientName} onChange={event=>setQuickRecipientName(event.target.value)} placeholder="ชื่อ-นามสกุล"/></label>}<label className="field full"><span>หมายเหตุ</span><input value={quickNote} onChange={event=>setQuickNote(event.target.value)} placeholder="ไม่บังคับ"/></label></div>}
        </div>
        <div className={`document-quick-result${quickStudent?" has-result":""}`}>{!quickStudent?<div className="document-quick-empty"><FontAwesomeIcon icon={faTabletScreenButton}/><b>รอกรอกเลขประจำตัวนักเรียน</b><span>ระบบจะตรวจการอนุมัติ เอกสาร และสถานะรับเครื่องก่อนบันทึก</span></div>:<><header><div><small>ข้อมูลนักเรียน</small><h3><StudentName row={quickStudent}/></h3><p>{text(quickStudent.grade_level)}/{text(quickStudent.room)}{quickStudent.class_number?` เลขที่ ${text(quickStudent.class_number)}`:""} · รหัส {text(quickStudent.student_code)}</p></div><HandoverStatus row={quickStudent}/></header><div className="handover-device-line"><span>Serial Number</span><b>{text(quickStudent.serial_number)||"ไม่ระบุ (ไม่บังคับ)"}</b></div>{quickStudent.eligible===false?<div className="document-ineligible"><FontAwesomeIcon icon={faBan}/><span>{text(quickStudent.eligibilityReason)}</span></div>:<><div className="document-enter-hint"><kbd>Enter</kbd><span>กดอีกครั้งเพื่อยืนยันรับเครื่อง</span></div><button type="button" className="button primary document-receive-button" disabled={busy} onClick={()=>void handover(quickStudent,quickRecipientType,quickRecipientName,quickNote,true)}><FontAwesomeIcon icon={busy?faSpinner:faCheck} spin={busy}/> บันทึกรับเครื่องแล้ว</button></>}</>}</div>
      </div>}
      {tab==="ROOM"&&<><div className="document-list-heading"><div><h2><FontAwesomeIcon icon={faSchool}/> สถานะรับเครื่องรายห้อง</h2><p>Serial Number เป็นข้อมูลเสริม สามารถบันทึกรับเครื่องได้แม้ยังไม่ได้กรอก</p></div></div><div className="handover-filters"><label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass}/><input value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} placeholder="ค้นหารหัสหรือชื่อนักเรียน..."/></label><select className="admin-input" value={grade} onChange={event=>{setGrade(event.target.value);setRoom("");setPage(1);}}><option value="">ทุกระดับชั้น</option>{grades.map(item=><option key={item}>{item}</option>)}</select><select className="admin-input" value={room} onChange={event=>{setRoom(event.target.value);setPage(1);}}><option value="">ทุกห้อง</option>{rooms.map(item=><option key={item} value={item}>/{item}</option>)}</select><select className="admin-input" value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="">ทุกสถานะ</option><option value="NOT_READY">เอกสารยังไม่พร้อม</option><option value="READY">พร้อมรับเครื่อง</option><option value="RECEIVED">รับเครื่องแล้ว</option><option value="RETURNED">คืนเครื่องแล้ว</option></select></div>{loading?<div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin/> กำลังโหลดข้อมูล...</div>:<div className="admin-table-wrap"><table className="admin-table handover-table"><thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ชั้น / ห้อง / เลขที่</th><th>เอกสาร</th><th>Serial Number</th><th>สถานะรับเครื่อง</th><th>วันรับ / ผู้ดำเนินการ</th><th>จัดการ</th></tr></thead><tbody>{rows.map(row=>{const rowStatus=text(row.handover_status);return <tr key={text(row.student_id)}><td><b>{text(row.student_code)}</b></td><td><StudentName row={row}/></td><td>{text(row.grade_level)}/{text(row.room)}{row.class_number?` เลขที่ ${text(row.class_number)}`:""}</td><td><span className={`document-status ${text(row.document_status)==="RECEIVED"?"received":"pending"}`}><FontAwesomeIcon icon={text(row.document_status)==="RECEIVED"?faCircleCheck:faClock}/>{text(row.document_status)==="RECEIVED"?"รับแล้ว":"ยังไม่รับ"}</span></td><td><code>{text(row.serial_number)||"ไม่ระบุ"}</code></td><td><HandoverStatus row={row}/></td><td>{rowStatus==="RECEIVED"?<><b className="document-receiver">{text(row.handed_over_by_name)||"ผู้ดูแลระบบ"}</b><small className="document-date">{formatDateTime(row.handed_over_at)}</small></>:rowStatus==="RETURNED"?<><b className="document-receiver">คืนแล้ว</b><small className="document-date">{formatDateTime(row.returned_at)}</small></>:"—"}</td><td><div className="table-actions">{rowStatus==="RECEIVED"?canCancel&&<button type="button" className="icon-button danger-icon-button" title="ยกเลิกสถานะรับเครื่อง" onClick={()=>setCancelTarget(row)}><FontAwesomeIcon icon={faXmark}/></button>:text(row.document_status)==="RECEIVED"?<button type="button" className="button handover-row-button" onClick={()=>setHandoverTarget(row)}><FontAwesomeIcon icon={faCheck}/> รับเครื่อง</button>:<span className="handover-waiting">รอเอกสาร</span>}</div></td></tr>;})}</tbody></table>{!rows.length&&<div className="empty-state small">ไม่พบรายการตามตัวกรอง</div>}<Pagination page={page} pages={pages} total={total} setPage={setPage}/></div>}</>}
      {tab==="HISTORY"&&<><div className="document-list-heading"><div><h2><FontAwesomeIcon icon={faHistory}/> ประวัติสถานะรับเครื่อง</h2><p>แสดงการรับเครื่อง การคืน และการยกเลิก พร้อมผู้ดำเนินการ</p></div></div><div className="handover-filters"><label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass}/><input value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} placeholder="ค้นหารหัสหรือชื่อนักเรียน..."/></label><select className="admin-input" value={grade} onChange={event=>{setGrade(event.target.value);setRoom("");setPage(1);}}><option value="">ทุกระดับชั้น</option>{grades.map(item=><option key={item}>{item}</option>)}</select><select className="admin-input" value={room} onChange={event=>{setRoom(event.target.value);setPage(1);}}><option value="">ทุกห้อง</option>{rooms.map(item=><option key={item} value={item}>/{item}</option>)}</select><select className="admin-input" value={historyAction} onChange={event=>{setHistoryAction(event.target.value);setPage(1);}}><option value="">ทุกการดำเนินการ</option><option value="HANDOVER">รับเครื่อง</option><option value="RETURN">คืนเครื่อง</option><option value="CANCEL">ยกเลิกสถานะ</option></select></div>{loading?<div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin/> กำลังโหลดประวัติ...</div>:<div className="admin-table-wrap"><table className="admin-table handover-history-table"><thead><tr><th>วันเวลา</th><th>นักเรียน</th><th>ชั้น / ห้อง</th><th>รายการ</th><th>ผู้มารับ</th><th>Serial Number</th><th>ผู้ดำเนินการ</th><th>หมายเหตุ</th></tr></thead><tbody>{historyRows.map(row=><tr key={text(row.id)}><td>{formatDateTime(row.created_at)}</td><td><b>{text(row.student_code)}</b><span><StudentName row={row}/></span></td><td>{text(row.grade_level)}/{text(row.room)}</td><td><EventBadge action={text(row.action)}/></td><td>{text(row.action)==="HANDOVER"?<Recipient row={row}/>:"—"}</td><td><code>{text(row.serial_number)||"ไม่ระบุ"}</code></td><td>{text(row.processed_by_name)||"ผู้ดูแลระบบ"}</td><td>{text(row.note)||"—"}</td></tr>)}</tbody></table>{!historyRows.length&&<div className="empty-state small">ยังไม่มีประวัติตามตัวกรอง</div>}<Pagination page={page} pages={historyPages} total={historyTotal} setPage={setPage}/></div>}</>}
    </section>
    {handoverTarget&&<HandoverModal row={handoverTarget} busy={busy} close={()=>setHandoverTarget(null)} submit={handover}/>}
    {cancelTarget&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setCancelTarget(null);}}><section className="modal document-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-handover-title" onMouseDown={event=>event.stopPropagation()}><div className="modal-icon danger-icon"><FontAwesomeIcon icon={faBan}/></div><h2 id="cancel-handover-title">ยกเลิกสถานะรับเครื่อง</h2><p><StudentName row={cancelTarget}/><br/>{text(cancelTarget.grade_level)}/{text(cancelTarget.room)}</p><form onSubmit={cancel}><label className="field"><span>เหตุผลในการยกเลิก <b>*</b></span><textarea name="reason" minLength={3} maxLength={500} required placeholder="เช่น บันทึกผิดคน"/></label><div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setCancelTarget(null)}>ไม่ยกเลิก</button><button className="button danger-solid" disabled={busy}><FontAwesomeIcon icon={busy?faSpinner:faBan} spin={busy}/> ยืนยันยกเลิก</button></div></form></section></div>}
  </>;
}

function HandoverModal({row,busy,close,submit}:{row:Row;busy:boolean;close:()=>void;submit:(row:Row,type:RecipientType,name:string,note:string)=>Promise<void>}) {
  const [type,setType]=useState<RecipientType>("STUDENT"),[name,setName]=useState("");
  function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const note=text(new FormData(event.currentTarget).get("note"));void submit(row,type,name,note);}
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close();}}><section className="modal return-device-modal" role="dialog" aria-modal="true" aria-labelledby="handover-modal-title" onMouseDown={event=>event.stopPropagation()}><header className="return-device-modal-header"><span><FontAwesomeIcon icon={faTabletScreenButton}/></span><div><small>ยืนยันการส่งมอบอุปกรณ์</small><h2 id="handover-modal-title">บันทึกรับเครื่อง</h2></div><button className="icon-button" type="button" disabled={busy} onClick={close} aria-label="ปิด"><FontAwesomeIcon icon={faXmark}/></button></header><div className="return-holder-card"><span className="holder-type student"><FontAwesomeIcon icon={faUserGraduate}/>นักเรียน</span><div><b><StudentName row={row}/></b><span>{text(row.grade_level)}/{text(row.room)} · รหัส {text(row.student_code)}</span></div><code>{text(row.serial_number)||"ไม่ระบุ Serial (ไม่บังคับ)"}</code></div><form className="return-device-form" onSubmit={save}><label className="field"><span>ผู้มารับ <b>*</b></span><select value={type} onChange={event=>setType(event.target.value as RecipientType)}><option value="STUDENT">นักเรียนรับเอง</option><option value="GUARDIAN">ผู้ปกครอง</option><option value="OTHER">ผู้รับแทน</option></select></label>{type!=="STUDENT"&&<label className="field"><span>ชื่อผู้มารับ <b>*</b></span><input required minLength={2} maxLength={200} value={name} onChange={event=>setName(event.target.value)} placeholder="ชื่อ-นามสกุล"/></label>}<label className="field full"><span>หมายเหตุ</span><textarea name="note" className="admin-input" rows={3} maxLength={500} placeholder="ไม่บังคับ"/></label><div className="modal-actions full"><button type="button" className="button secondary" disabled={busy} onClick={close}>ยกเลิก</button><button className="button primary" disabled={busy}><FontAwesomeIcon icon={busy?faSpinner:faCheck} spin={busy}/>{busy?"กำลังบันทึก...":"ยืนยันรับเครื่อง"}</button></div></form></section></div>;
}

function EventBadge({action}:{action:string}) { const detail=action==="HANDOVER"?{label:"รับเครื่อง",icon:faCircleCheck}:action==="RETURN"?{label:"คืนเครื่อง",icon:faRotateLeft}:{label:"ยกเลิก",icon:faBan};return <span className={`handover-event ${action.toLowerCase()}`}><FontAwesomeIcon icon={detail.icon}/>{detail.label}</span>; }

function Pagination({page,pages,total,setPage}:{page:number;pages:number;total:number;setPage:(page:number)=>void}) { if(total<=PAGE_SIZE)return null;const first=(page-1)*PAGE_SIZE+1,last=Math.min(page*PAGE_SIZE,total);return <nav className="table-pagination" aria-label="เปลี่ยนหน้ารายการสถานะรับเครื่อง"><span>แถว {first.toLocaleString("th-TH")}-{last.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")}</span><div><button type="button" disabled={page<=1} onClick={()=>setPage(Math.max(1,page-1))}><FontAwesomeIcon icon={faChevronLeft}/></button><b>หน้า {page.toLocaleString("th-TH")} / {pages.toLocaleString("th-TH")}</b><button type="button" disabled={page>=pages} onClick={()=>setPage(Math.min(pages,page+1))}><FontAwesomeIcon icon={faChevronRight}/></button></div></nav>; }
