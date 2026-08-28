"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faChalkboardTeacher,
  faFloppyDisk,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faSchool,
  faSpinner,
  faTrash,
  faTriangleExclamation,
  faUserTie,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";
import { studentGradeOptions, studentRoomOptions } from "@/lib/data/student-options";

type Row = Record<string, unknown>;
type Editor = { id?: string; gradeLevel: string; room: string; teacherIds: [string,string] };
const s = (value: unknown) => value == null ? "" : String(value);
const n = (value: unknown) => Number(value ?? 0);

export function AdvisorAdmin() {
  const [assignments,setAssignments] = useState<Row[]>([]);
  const [teachers,setTeachers] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [search,setSearch] = useState("");
  const [grade,setGrade] = useState("");
  const [editor,setEditor] = useState<Editor|null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/advisors");
      const body = await readJson<{assignments:Row[];teachers:Row[];error?:string}>(response);
      if (!response.ok) throw new Error(body.error);
      setAssignments(body.assignments ?? []);
      setTeachers(body.teachers ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดข้อมูลครูที่ปรึกษาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  useEffect(() => {
    if (!editor) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = old; };
  },[editor]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments.filter(row =>
      (!grade || s(row.grade_level) === grade) &&
      (!query || [row.grade_level,row.room,row.advisor1_name,row.advisor1_learning_area,row.advisor2_name,row.advisor2_learning_area].some(value => s(value).toLowerCase().includes(query)))
    );
  },[assignments,grade,search]);
  const assigned = assignments.filter(row => Boolean(row.advisor1_id)).length;
  const studentRooms = assignments.filter(row => n(row.student_count) > 0).length;
  const unassigned = assignments.filter(row => n(row.student_count) > 0 && !row.advisor1_id).length;

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/advisors",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"save",id:editor.id,gradeLevel:editor.gradeLevel,room:editor.room,teacherIds:editor.teacherIds.filter(Boolean)}),
      });
      const body = await readJson<{error?:string}>(response);
      if (!response.ok) throw new Error(body.error);
      toast.success("บันทึกครูที่ปรึกษาเรียบร้อย");
      setEditor(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  async function remove(row:Row) {
    if (!confirm(`ยกเลิกครูที่ปรึกษา ${s(row.grade_level)}/${s(row.room)} หรือไม่`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/advisors",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",gradeLevel:s(row.grade_level),room:s(row.room)}),
      });
      const body = await readJson<{error?:string}>(response);
      if (!response.ok) throw new Error(body.error);
      toast.success("ยกเลิกครูที่ปรึกษาแล้ว");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ยกเลิกรายการไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  return <>
    <div className="admin-topline">
      <div><span className="eyebrow">ข้อมูลประจำชั้น</span><h1 className="admin-page-title"><FontAwesomeIcon icon={faUserTie}/> ครูที่ปรึกษา</h1></div>
      <button className="button primary" onClick={()=>setEditor({gradeLevel:"",room:"",teacherIds:["",""]})}><FontAwesomeIcon icon={faPlus}/> กำหนดครูที่ปรึกษา</button>
    </div>
    <div className="advisor-kpis">
      <AdvisorKpi icon={faSchool} label="ห้องที่มีนักเรียน" value={studentRooms} tone="blue"/>
      <AdvisorKpi icon={faUserTie} label="กำหนดแล้ว" value={assigned} tone="green"/>
      <AdvisorKpi icon={faTriangleExclamation} label="ยังไม่กำหนด" value={unassigned} tone="amber"/>
    </div>
    <section className="admin-panel advisor-panel">
      <div className="advisor-panel-heading">
        <div><h2><FontAwesomeIcon icon={faChalkboardTeacher}/> ห้องเรียนและครูที่ปรึกษา</h2><p>ชื่อครูจะเชื่อมกับนักเรียนตามชั้นและห้องโดยอัตโนมัติ</p></div>
        <span>{filtered.length} ห้อง</span>
      </div>
      <div className="toolbar advisor-toolbar">
        <label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="ค้นหาห้องหรือชื่อครู..."/></label>
        <select className="admin-input" value={grade} onChange={event=>setGrade(event.target.value)} aria-label="กรองระดับชั้น"><option value="">ทุกระดับชั้น</option>{studentGradeOptions.map(item=><option key={item}>{item}</option>)}</select>
      </div>
      {loading ? <div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin/> กำลังโหลดข้อมูล...</div> :
      <div className="admin-table-wrap"><table className="admin-table advisor-table"><thead><tr><th>ชั้น / ห้อง</th><th>นักเรียน</th><th>ครูที่ปรึกษา</th><th>กลุ่มสาระ</th><th>จัดการ</th></tr></thead><tbody>
        {filtered.map(row=><tr key={`${s(row.grade_level)}-${s(row.room)}`}>
          <td><b>{s(row.grade_level)}/{s(row.room)}</b></td>
          <td><span className="advisor-student-count"><FontAwesomeIcon icon={faUsers}/>{n(row.student_count)} คน</span></td>
          <td>{row.advisor1_name?<div className="advisor-name-list"><AdvisorName name={s(row.advisor1_name)} order={1}/>{row.advisor2_name&&<AdvisorName name={s(row.advisor2_name)} order={2}/>}</div>:<span className="badge advisor-missing"><FontAwesomeIcon icon={faTriangleExclamation}/>ยังไม่กำหนด</span>}</td>
          <td><div className="advisor-area-list"><span>{s(row.advisor1_learning_area)||"—"}</span>{row.advisor2_name&&<span>{s(row.advisor2_learning_area)||"—"}</span>}</div></td>
          <td><div className="table-actions"><button className="icon-button" title="แก้ไขครูที่ปรึกษา" aria-label="แก้ไขครูที่ปรึกษา" onClick={()=>setEditor({id:s(row.id)||undefined,gradeLevel:s(row.grade_level),room:s(row.room),teacherIds:[s(row.advisor1_id),s(row.advisor2_id)]})}><FontAwesomeIcon icon={row.advisor1_id?faPen:faPlus}/></button>{row.id&&<button className="icon-button danger-icon-button" disabled={busy} title="ยกเลิกครูที่ปรึกษา" aria-label="ยกเลิกครูที่ปรึกษา" onClick={()=>void remove(row)}><FontAwesomeIcon icon={faTrash}/></button>}</div></td>
        </tr>)}
      </tbody></table>{!filtered.length&&<div className="empty-state small">ไม่พบข้อมูลห้องเรียน</div>}</div>}
    </section>
    {editor&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setEditor(null)}}><section className="modal advisor-editor-modal" onMouseDown={event=>event.stopPropagation()}>
      <header className="advisor-editor-header"><div><span><FontAwesomeIcon icon={faUserTie}/></span><div><small>ประจำชั้นเรียน</small><h2>{editor.id?"แก้ไขครูที่ปรึกษา":"กำหนดครูที่ปรึกษา"}</h2></div></div><button className="icon-button" type="button" onClick={()=>setEditor(null)} aria-label="ปิด"><FontAwesomeIcon icon={faXmark}/></button></header>
      <form className="advisor-editor-form" onSubmit={save}>
        <div className="advisor-class-fields"><label className="field"><span>ระดับชั้น <b>*</b></span><select value={editor.gradeLevel} onChange={event=>setEditor({...editor,gradeLevel:event.target.value})} required><option value="" disabled>เลือกระดับชั้น</option>{studentGradeOptions.map(item=><option key={item}>{item}</option>)}</select></label><label className="field"><span>ห้อง <b>*</b></span><select value={editor.room} onChange={event=>setEditor({...editor,room:event.target.value})} required><option value="" disabled>เลือกห้อง</option>{studentRoomOptions.map(item=><option key={item} value={item}>/{item}</option>)}</select></label></div>
        <div className="advisor-teacher-fields"><AdvisorCombobox label="ครูที่ปรึกษาคนที่ 1" required teachers={teachers} value={editor.teacherIds[0]} excludeId={editor.teacherIds[1]} onChange={teacherId=>setEditor({...editor,teacherIds:[teacherId,editor.teacherIds[1]]})}/>
        <AdvisorCombobox label="ครูที่ปรึกษาคนที่ 2" teachers={teachers} value={editor.teacherIds[1]} excludeId={editor.teacherIds[0]} onChange={teacherId=>setEditor({...editor,teacherIds:[editor.teacherIds[0],teacherId]})}/></div>
        <p className="advisor-auto-note"><FontAwesomeIcon icon={faUsers}/> นักเรียนที่อยู่ชั้นและห้องนี้ รวมถึงนักเรียนที่ย้ายเข้าภายหลัง จะเชื่อมกับครูที่ปรึกษาคนนี้โดยอัตโนมัติ</p>
        <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setEditor(null)}>ยกเลิก</button><button className="button primary" disabled={busy}><FontAwesomeIcon icon={busy?faSpinner:faFloppyDisk} spin={busy}/>{busy?"กำลังบันทึก...":"บันทึก"}</button></div>
      </form>
    </section></div>}
  </>;
}

function AdvisorKpi({icon,label,value,tone}:{icon:IconDefinition;label:string;value:number;tone:string}) {
  return <div className={`advisor-kpi ${tone}`}><span><FontAwesomeIcon icon={icon}/></span><div><small>{label}</small><b>{value} <em>ห้อง</em></b></div></div>;
}

function AdvisorName({name,order}:{name:string;order:number}) {
  return <div className="advisor-name"><span>{order}</span><b>{name}</b></div>;
}

function teacherLabel(teacher:Row) {
  return `${s(teacher.prefix)}${s(teacher.first_name)} ${s(teacher.last_name)}`.trim();
}

function AdvisorCombobox({label,required=false,teachers,value,excludeId,onChange}:{label:string;required?:boolean;teachers:Row[];value:string;excludeId:string;onChange:(teacherId:string)=>void}) {
  const listId = useId();
  const selected = teachers.find(teacher=>s(teacher.id)===value);
  const [query,setQuery] = useState(selected?teacherLabel(selected):"");
  const [open,setOpen] = useState(false);
  const available = useMemo(() => {
    const needle=query.trim().toLowerCase();
    return teachers.filter(teacher=>s(teacher.id)!==excludeId && (!needle || `${teacherLabel(teacher)} ${s(teacher.learning_area)} ${s(teacher.teacher_code)}`.toLowerCase().includes(needle))).slice(0,12);
  },[teachers,excludeId,query]);
  function choose(teacher:Row) {
    onChange(s(teacher.id));
    setQuery(teacherLabel(teacher));
    setOpen(false);
  }
  return <label className="field advisor-combobox-field"><span>{label}{required?<b>*</b>:<small>ไม่บังคับ</small>}</span><div className={`advisor-combobox${open?" is-open":""}`}>
    <FontAwesomeIcon icon={faMagnifyingGlass}/><input value={query} required={required} autoComplete="off" role="combobox" aria-controls={listId} aria-expanded={open} aria-autocomplete="list" placeholder={required?"พิมพ์ชื่อครูเพื่อค้นหา":"พิมพ์ชื่อ หรือเว้นว่าง"} onFocus={event=>{event.currentTarget.select();setOpen(true)}} onBlur={()=>window.setTimeout(()=>setOpen(false),120)} onChange={event=>{setQuery(event.target.value);if(value)onChange("");setOpen(true)}}/>
    {query&&<button type="button" aria-label={`ล้าง${label}`} onMouseDown={event=>event.preventDefault()} onClick={()=>{setQuery("");onChange("");setOpen(true)}}><FontAwesomeIcon icon={faXmark}/></button>}
    {open&&<div id={listId} className="advisor-combobox-menu" role="listbox">{available.length?available.map(teacher=><button type="button" role="option" aria-selected={s(teacher.id)===value} key={s(teacher.id)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(teacher)}><span><b>{teacherLabel(teacher)}</b><small>{s(teacher.learning_area)}</small></span>{s(teacher.id)===value&&<FontAwesomeIcon icon={faUserTie}/>}</button>):<p>ไม่พบรายชื่อครูที่ตรงกัน</p>}</div>}
  </div></label>;
}
