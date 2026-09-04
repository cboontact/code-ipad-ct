"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck, faEye, faEyeSlash, faFloppyDisk, faPen, faPlus,
  faShieldHalved, faSpinner, faTrash, faUserShield, faUsersGear, faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";

type AdminRow = { id:string; username:string; display_name:string; role:"superadmin"|"admin"; last_login_at:string|null; created_at:string };
type FormState = { username:string; displayName:string; password:string; confirmPassword:string; role:"superadmin"|"admin" };
const emptyForm:FormState={username:"",displayName:"",password:"",confirmPassword:"",role:"admin"};

function formatDate(value:string|null){
  if(!value)return "ยังไม่เคยเข้าสู่ระบบ";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"}).format(date);
}

export function AdminUsersManager({currentAdminId}:{currentAdminId:string}){
  const [rows,setRows]=useState<AdminRow[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[editorOpen,setEditorOpen]=useState(false),[editTarget,setEditTarget]=useState<AdminRow|null>(null),[deleteTarget,setDeleteTarget]=useState<AdminRow|null>(null),[showPassword,setShowPassword]=useState(false),[form,setForm]=useState<FormState>(emptyForm);
  const load=useCallback(async()=>{
    setLoading(true);
    try{const response=await fetch("/api/admin/admin-users",{cache:"no-store"}),body=await readJson<{rows?:AdminRow[];error?:string}>(response);if(!response.ok)throw new Error(body.error||"โหลดข้อมูลไม่สำเร็จ");setRows(body.rows??[])}
    catch(error){toast.error(error instanceof Error?error.message:"โหลดข้อมูลไม่สำเร็จ")}finally{setLoading(false)}
  },[]);
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  },[load]);
  const summary=useMemo(()=>({total:rows.length,superadmins:rows.filter(row=>row.role==="superadmin").length,admins:rows.filter(row=>row.role==="admin").length}),[rows]);
  function openCreate(){setEditTarget(null);setForm(emptyForm);setShowPassword(false);setEditorOpen(true)}
  function openEdit(row:AdminRow){setEditTarget(row);setForm({username:row.username,displayName:row.display_name,password:"",confirmPassword:"",role:row.role});setShowPassword(false);setEditorOpen(true)}
  function closeEditor(){if(busy)return;setEditorOpen(false);setEditTarget(null);setShowPassword(false);setForm(emptyForm)}
  async function submit(event:FormEvent){
    event.preventDefault();if(form.password!==form.confirmPassword){toast.error("ยืนยันรหัสผ่านไม่ตรงกัน");return}setBusy(true);
    try{const editing=Boolean(editTarget),response=await fetch("/api/admin/admin-users",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{id:editTarget?.id,username:form.username,displayName:form.displayName,password:form.password||undefined,role:form.role}:{username:form.username,displayName:form.displayName,password:form.password,role:form.role})}),body=await readJson<{error?:string}>(response);if(!response.ok)throw new Error(body.error||(editing?"แก้ไขผู้ดูแลไม่สำเร็จ":"เพิ่มผู้ดูแลไม่สำเร็จ"));toast.success(editing?"แก้ไขข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว":"เพิ่มผู้ดูแลระบบเรียบร้อยแล้ว");const editedSelf=editTarget?.id===currentAdminId;setEditorOpen(false);setEditTarget(null);setShowPassword(false);setForm(emptyForm);if(editedSelf)window.setTimeout(()=>window.location.reload(),350);else await load()}
    catch(error){toast.error(error instanceof Error?error.message:(editTarget?"แก้ไขผู้ดูแลไม่สำเร็จ":"เพิ่มผู้ดูแลไม่สำเร็จ"))}finally{setBusy(false)}
  }
  async function remove(){
    if(!deleteTarget)return;setBusy(true);
    try{const response=await fetch("/api/admin/admin-users",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:deleteTarget.id})}),body=await readJson<{error?:string}>(response);if(!response.ok)throw new Error(body.error||"ลบผู้ดูแลไม่สำเร็จ");toast.success("ลบผู้ดูแลระบบเรียบร้อยแล้ว");setDeleteTarget(null);await load()}
    catch(error){toast.error(error instanceof Error?error.message:"ลบผู้ดูแลไม่สำเร็จ")}finally{setBusy(false)}
  }
  return <>
    <div className="admin-topline admin-users-topline"><div><span className="eyebrow">สิทธิ์การเข้าถึงระบบ</span><h1 className="admin-page-title"><FontAwesomeIcon icon={faUsersGear}/> จัดการผู้ดูแลระบบ</h1></div><button className="button primary" type="button" onClick={openCreate}><FontAwesomeIcon icon={faPlus}/> เพิ่มผู้ดูแล</button></div>
    <div className="admin-user-kpis" aria-label="สรุปบัญชีผู้ดูแล">
      <div className="admin-user-kpi"><span><FontAwesomeIcon icon={faUsersGear}/></span><div><small>ผู้ดูแลทั้งหมด</small><b>{summary.total}</b><em>บัญชี</em></div></div>
      <div className="admin-user-kpi teal"><span><FontAwesomeIcon icon={faUserShield}/></span><div><small>ผู้ดูแลระดับสูง</small><b>{summary.superadmins}</b><em>บัญชี</em></div></div>
      <div className="admin-user-kpi amber"><span><FontAwesomeIcon icon={faShieldHalved}/></span><div><small>ผู้ดูแลทั่วไป</small><b>{summary.admins}</b><em>บัญชี</em></div></div>
    </div>
    <section className="admin-panel admin-users-panel">
      <header className="admin-users-heading"><div><h2><FontAwesomeIcon icon={faUserShield}/> บัญชีที่เข้าใช้งานได้</h2><p>เพิ่มหรือนำสิทธิ์ผู้ดูแลออกโดยไม่กระทบประวัติการทำรายการเดิม</p></div><span>{rows.length} บัญชี</span></header>
      {loading?<div className="empty-state"><FontAwesomeIcon icon={faSpinner} spin/><p>กำลังโหลดข้อมูล...</p></div>:rows.length===0?<div className="empty-state"><FontAwesomeIcon icon={faUserShield}/><p>ยังไม่มีบัญชีผู้ดูแล</p></div>:<div className="admin-table-wrap"><table className="admin-table admin-users-table"><thead><tr><th>ชื่อผู้ดูแล</th><th>ชื่อผู้ใช้</th><th>ระดับสิทธิ์</th><th>เข้าสู่ระบบล่าสุด</th><th>จัดการ</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>
        <td data-label="ชื่อผู้ดูแล"><b>{row.display_name}</b>{row.id===currentAdminId&&<small className="current-admin-label"><FontAwesomeIcon icon={faCircleCheck}/> บัญชีที่กำลังใช้งาน</small>}</td>
        <td data-label="ชื่อผู้ใช้"><code>{row.username}</code></td>
        <td data-label="ระดับสิทธิ์"><span className={`badge ${row.role==="superadmin"?"accept":"pending"}`}><FontAwesomeIcon icon={row.role==="superadmin"?faUserShield:faShieldHalved}/>{row.role==="superadmin"?"ผู้ดูแลระดับสูง":"ผู้ดูแลทั่วไป"}</span></td>
        <td data-label="เข้าสู่ระบบล่าสุด">{formatDate(row.last_login_at)}</td>
        <td data-label="จัดการ"><div className="table-actions"><button type="button" className="icon-button" onClick={()=>openEdit(row)} aria-label={`แก้ไขผู้ดูแล ${row.display_name}`} title="แก้ไขผู้ดูแล"><FontAwesomeIcon icon={faPen}/></button>{row.id!==currentAdminId&&<button type="button" className="icon-button danger-icon-button" onClick={()=>setDeleteTarget(row)} aria-label={`ลบผู้ดูแล ${row.display_name}`} title="ลบผู้ดูแล"><FontAwesomeIcon icon={faTrash}/></button>}</div></td>
      </tr>)}</tbody></table></div>}
    </section>
    {editorOpen&&<div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&closeEditor()}><section className="modal admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="add-admin-title" onMouseDown={event=>event.stopPropagation()}>
      <header className="admin-user-modal-header"><div><span><FontAwesomeIcon icon={editTarget?faPen:faUserShield}/></span><div><small>{editTarget?"แก้ไขบัญชีผู้ดูแล":"บัญชีผู้ดูแลใหม่"}</small><h2 id="add-admin-title">{editTarget?"แก้ไขข้อมูลผู้ดูแลระบบ":"เพิ่มผู้ดูแลระบบ"}</h2></div></div><button className="icon-button" type="button" onClick={closeEditor} aria-label="ปิด"><FontAwesomeIcon icon={faXmark}/></button></header>
      <form onSubmit={submit} className="admin-user-form">
        <label className="field"><span>ชื่อที่แสดง <b>*</b></span><input required maxLength={100} value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})} placeholder="เช่น นายสมชาย ใจดี"/></label>
        <label className="field"><span>ชื่อผู้ใช้ <b>*</b></span><input required minLength={3} maxLength={50} autoCapitalize="none" autoComplete="off" value={form.username} onChange={event=>setForm({...form,username:event.target.value})} placeholder="a-z, 0-9, จุด หรือขีด"/></label>
        <label className="field full"><span>ระดับสิทธิ์ <b>*</b></span><select value={form.role} disabled={editTarget?.id===currentAdminId} onChange={event=>setForm({...form,role:event.target.value as FormState["role"]})}><option value="admin">ผู้ดูแลทั่วไป</option><option value="superadmin">ผู้ดูแลระดับสูง</option></select><small>{editTarget?.id===currentAdminId?"ไม่สามารถเปลี่ยนระดับสิทธิ์ของบัญชีที่กำลังใช้งานอยู่":"ผู้ดูแลระดับสูงสามารถเพิ่ม แก้ไข และลบบัญชีผู้ดูแลอื่นได้"}</small></label>
        <label className="field"><span>{editTarget?"รหัสผ่านใหม่ (ไม่บังคับ)":"รหัสผ่าน"} {!editTarget&&<b>*</b>}</span><div className="password-field"><input required={!editTarget} minLength={8} maxLength={128} type={showPassword?"text":"password"} autoComplete="new-password" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} placeholder={editTarget?"เว้นว่างหากไม่ต้องการเปลี่ยน":"อย่างน้อย 8 ตัวอักษร"}/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน"}><FontAwesomeIcon icon={showPassword?faEyeSlash:faEye}/></button></div></label>
        <label className="field"><span>{editTarget?"ยืนยันรหัสผ่านใหม่":"ยืนยันรหัสผ่าน"} {!editTarget&&<b>*</b>}</span><input required={!editTarget} minLength={8} maxLength={128} type={showPassword?"text":"password"} autoComplete="new-password" value={form.confirmPassword} onChange={event=>setForm({...form,confirmPassword:event.target.value})} placeholder={editTarget?"กรอกเมื่อเปลี่ยนรหัสผ่าน":"กรอกรหัสผ่านอีกครั้ง"}/></label>
        <div className="modal-actions full"><button className="button secondary" type="button" disabled={busy} onClick={closeEditor}>ยกเลิก</button><button className="button primary" disabled={busy}><FontAwesomeIcon icon={busy?faSpinner:faFloppyDisk} spin={busy}/>{busy?"กำลังบันทึก...":editTarget?"บันทึกการแก้ไข":"บันทึกผู้ดูแล"}</button></div>
      </form>
    </section></div>}
    {deleteTarget&&<div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&!busy&&setDeleteTarget(null)}><section className="modal admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-admin-title" onMouseDown={event=>event.stopPropagation()}><div className="modal-icon danger-icon"><FontAwesomeIcon icon={faTrash}/></div><h2 id="delete-admin-title">ลบสิทธิ์ผู้ดูแลระบบ</h2><p>บัญชี <b>{deleteTarget.display_name}</b> ({deleteTarget.username}) จะออกจากระบบทันทีและไม่สามารถเข้าสู่ระบบได้อีก</p><div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={()=>setDeleteTarget(null)}>ยกเลิก</button><button className="button danger-solid" type="button" disabled={busy} onClick={()=>void remove()}><FontAwesomeIcon icon={busy?faSpinner:faTrash} spin={busy}/>{busy?"กำลังลบ...":"ยืนยันลบ"}</button></div></section></div>}
  </>
}
