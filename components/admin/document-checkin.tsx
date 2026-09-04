"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faClock,
  faFileCircleCheck,
  faHistory,
  faListCheck,
  faMagnifyingGlass,
  faSchool,
  faSpinner,
  faUserCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";

type Row = Record<string, unknown>;
type Tab = "QUICK" | "ROOM" | "HISTORY";
type Summary = { total: number; received: number; pending: number };
type Option = { grade_level: string; room: string };
const PAGE_SIZE = 50;
const text = (value: unknown) => value == null ? "" : String(value);

function formatDateTime(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function StudentName({ row }: { row: Row }) {
  return <>{text(row.prefix)}{text(row.first_name)} {text(row.last_name)}</>;
}

function DocumentStatus({ row }: { row: Row }) {
  const received = text(row.document_status) === "RECEIVED";
  return (
    <span className={`document-status ${received ? "received" : "pending"}`}>
      <FontAwesomeIcon icon={received ? faCircleCheck : faClock}/>
      {received ? "รับเอกสารแล้ว" : "ยังไม่ได้รับ"}
    </span>
  );
}

export function DocumentCheckin({ canCancel }: { canCancel: boolean }) {
  const [tab, setTab] = useState<Tab>("QUICK");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, received: 0, pending: 0 });
  const [options, setOptions] = useState<Option[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [studentCode, setStudentCode] = useState("");
  const [quickStudent, setQuickStudent] = useState<Row | null>(null);
  const [historyRows, setHistoryRows] = useState<Row[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyAction, setHistoryAction] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  const grades = useMemo(() => [...new Set(options.map((item) => text(item.grade_level)).filter(Boolean))], [options]);
  const rooms = useMemo(() => [...new Set(options.filter((item) => !grade || text(item.grade_level) === grade).map((item) => text(item.room)).filter(Boolean))], [options, grade]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const historyPages = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE));
  const pendingOnPage = rows.filter((row) => text(row.document_status) !== "RECEIVED").map((row) => text(row.student_id));
  const allPendingSelected = pendingOnPage.length > 0 && pendingOnPage.every((studentId) => selectedIds.includes(studentId));

  function filterParams(mode: "list" | "history") {
    const params = new URLSearchParams({ mode, page: String(page) });
    if (search.trim()) params.set("search", search.trim());
    if (grade) params.set("grade", grade);
    if (room) params.set("room", room);
    if (mode === "list" && status) params.set("status", status);
    if (mode === "history" && historyAction) params.set("action", historyAction);
    return params;
  }

  async function loadList(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/admin/document-checkin?${filterParams("list")}`, { cache: "no-store" });
      const body = await readJson<{ rows?: Row[]; summary?: Summary; options?: Option[]; total?: number; error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      setRows(body.rows ?? []);
      setSummary(body.summary ?? { total: 0, received: 0, pending: 0 });
      setOptions(body.options ?? []);
      setTotal(Number(body.total ?? 0));
      setSelectedIds([]);
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "โหลดข้อมูลเอกสารไม่สำเร็จ");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadHistory(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/admin/document-checkin?${filterParams("history")}`, { cache: "no-store" });
      const body = await readJson<{ rows?: Row[]; total?: number; error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      setHistoryRows(body.rows ?? []);
      setHistoryTotal(Number(body.total ?? 0));
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === "HISTORY") void loadHistory();
      else void loadList();
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, search, grade, room, status, historyAction]);

  useEffect(() => {
    if (!cancelTarget) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [cancelTarget]);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
    setSearch("");
    setGrade("");
    setRoom("");
    setStatus("");
    setHistoryAction("");
    if (next === "QUICK") window.setTimeout(() => codeInput.current?.focus(), 0);
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    const code = studentCode.trim();
    if (!code) { toast.warning("กรุณากรอกเลขประจำตัวนักเรียน"); return; }
    setBusy(true);
    setQuickStudent(null);
    try {
      const params = new URLSearchParams({ mode: "lookup", studentCode: code });
      const response = await fetch(`/api/admin/document-checkin?${params}`, { cache: "no-store" });
      const body = await readJson<{ student?: Row; error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      setQuickStudent(body.student ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ค้นหานักเรียนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function receive(studentIds: string[], quick = false) {
    if (!studentIds.length) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/document-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive", studentIds }),
      });
      const body = await readJson<{ received?: number; alreadyReceived?: number; error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      const received = Number(body.received ?? 0);
      toast.success(received > 0 ? `บันทึกรับเอกสารแล้ว ${received.toLocaleString("th-TH")} รายการ` : "รายการนี้รับเอกสารแล้วก่อนหน้านี้");
      setSelectedIds([]);
      if (quick) {
        setQuickStudent(null);
        setStudentCode("");
        window.setTimeout(() => codeInput.current?.focus(), 0);
      }
      await Promise.all([loadList(true), loadHistory(true)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกรับเอกสารไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function cancelReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelTarget) return;
    const reason = text(new FormData(event.currentTarget).get("reason")).trim();
    setBusy(true);
    try {
      const response = await fetch("/api/admin/document-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", studentId: text(cancelTarget.student_id), reason }),
      });
      const body = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      toast.success("ยกเลิกสถานะรับเอกสารแล้ว");
      setCancelTarget(null);
      if (text(quickStudent?.student_id) === text(cancelTarget.student_id)) {
        setQuickStudent({ ...quickStudent, document_status: "PENDING", received_at: null, received_by_name: null });
      }
      await Promise.all([loadList(true), loadHistory(true)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ยกเลิกสถานะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function toggleAllPending() {
    setSelectedIds((current) => allPendingSelected
      ? current.filter((studentId) => !pendingOnPage.includes(studentId))
      : [...new Set([...current, ...pendingOnPage])]);
  }

  return (
    <>
      <div className="admin-topline document-checkin-topline">
        <div>
          <span className="eyebrow">ระบบติดตามเอกสาร AWAT-03</span>
          <h1 className="admin-page-title"><FontAwesomeIcon icon={faFileCircleCheck}/> ตรวจรับเอกสาร</h1>
          <p>สำหรับนักเรียนที่ลงทะเบียนเลือกรับ iPad และรายการไม่ได้ถูกปฏิเสธ</p>
        </div>
      </div>

      <div className="document-checkin-summary">
        <article><span><FontAwesomeIcon icon={faListCheck}/></span><div><small>ต้องส่งเอกสาร</small><b>{summary.total.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
        <article className="received"><span><FontAwesomeIcon icon={faCircleCheck}/></span><div><small>รับเอกสารแล้ว</small><b>{summary.received.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
        <article className="pending"><span><FontAwesomeIcon icon={faClock}/></span><div><small>ยังไม่ได้รับ</small><b>{summary.pending.toLocaleString("th-TH")}</b><em>ราย</em></div></article>
      </div>

      <section className="admin-panel document-checkin-panel">
        <div className="document-checkin-tabs" role="tablist" aria-label="รูปแบบตรวจรับเอกสาร">
          <button type="button" role="tab" aria-selected={tab === "QUICK"} className={tab === "QUICK" ? "active" : ""} onClick={() => changeTab("QUICK")}><FontAwesomeIcon icon={faUserCheck}/><span>เช็คด่วน</span></button>
          <button type="button" role="tab" aria-selected={tab === "ROOM"} className={tab === "ROOM" ? "active" : ""} onClick={() => changeTab("ROOM")}><FontAwesomeIcon icon={faSchool}/><span>ตรวจรายห้อง</span></button>
          <button type="button" role="tab" aria-selected={tab === "HISTORY"} className={tab === "HISTORY" ? "active" : ""} onClick={() => changeTab("HISTORY")}><FontAwesomeIcon icon={faHistory}/><span>ประวัติ</span></button>
        </div>

        {tab === "QUICK" && (
          <div className="document-quick-layout">
            <div className="document-quick-entry">
              <span className="document-quick-icon"><FontAwesomeIcon icon={faMagnifyingGlass}/></span>
              <div><h2>ตรวจรับเอกสารแบบรวดเร็ว</h2><p>กรอกเลขประจำตัวนักเรียนแล้วกด Enter</p></div>
              <form onSubmit={lookup}>
                <label className="field"><span>เลขประจำตัวนักเรียน</span><input ref={codeInput} autoFocus inputMode="numeric" autoComplete="off" value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="เช่น 23964"/></label>
                <button className="button primary" disabled={busy}><FontAwesomeIcon icon={busy ? faSpinner : faMagnifyingGlass} spin={busy}/> ตรวจสอบ</button>
              </form>
            </div>
            <div className={`document-quick-result${quickStudent ? " has-result" : ""}`}>
              {!quickStudent ? <div className="document-quick-empty"><FontAwesomeIcon icon={faFileCircleCheck}/><b>รอกรอกเลขประจำตัวนักเรียน</b><span>ระบบจะแสดงชื่อ ชั้น ห้อง และสถานะเอกสารก่อนบันทึก</span></div> : <>
                <header><div><small>ข้อมูลนักเรียน</small><h3><StudentName row={quickStudent}/></h3><p>{text(quickStudent.grade_level)}/{text(quickStudent.room)}{quickStudent.class_number ? ` เลขที่ ${text(quickStudent.class_number)}` : ""} · รหัส {text(quickStudent.student_code)}</p></div><DocumentStatus row={quickStudent}/></header>
                {quickStudent.eligible === false ? <div className="document-ineligible"><FontAwesomeIcon icon={faBan}/><span>{text(quickStudent.eligibilityReason)}</span></div> : text(quickStudent.document_status) === "RECEIVED" ? <div className="document-received-detail"><span>รับเมื่อ <b>{formatDateTime(quickStudent.received_at)}</b></span><span>ผู้รับเอกสาร <b>{text(quickStudent.received_by_name) || "ผู้ดูแลระบบ"}</b></span>{canCancel && <button type="button" className="button danger-outline" disabled={busy} onClick={() => setCancelTarget(quickStudent)}><FontAwesomeIcon icon={faXmark}/> ยกเลิกสถานะ</button>}</div> : <button type="button" className="button primary document-receive-button" disabled={busy} onClick={() => void receive([text(quickStudent.student_id)], true)}><FontAwesomeIcon icon={busy ? faSpinner : faCheck} spin={busy}/> บันทึกรับเอกสารแล้ว</button>}
              </>}
            </div>
          </div>
        )}

        {tab === "ROOM" && <>
          <div className="document-list-heading"><div><h2><FontAwesomeIcon icon={faSchool}/> ตรวจเอกสารรายห้อง</h2><p>เลือกนักเรียนที่นำเอกสารมาส่ง แล้วบันทึกพร้อมกันได้สูงสุด 50 รายการ</p></div>{selectedIds.length > 0 && <button type="button" className="button primary" disabled={busy} onClick={() => { if (window.confirm(`ยืนยันรับเอกสาร ${selectedIds.length.toLocaleString("th-TH")} รายการหรือไม่`)) void receive(selectedIds); }}><FontAwesomeIcon icon={busy ? faSpinner : faCheck} spin={busy}/> รับเอกสาร {selectedIds.length.toLocaleString("th-TH")} รายการ</button>}</div>
          <div className="document-filters">
            <label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหารหัสหรือชื่อนักเรียน..."/></label>
            <select className="admin-input" value={grade} onChange={(event) => { setGrade(event.target.value); setRoom(""); setPage(1); }} aria-label="กรองระดับชั้น"><option value="">ทุกระดับชั้น</option>{grades.map((item) => <option key={item}>{item}</option>)}</select>
            <select className="admin-input" value={room} onChange={(event) => { setRoom(event.target.value); setPage(1); }} aria-label="กรองห้อง"><option value="">ทุกห้อง</option>{rooms.map((item) => <option key={item} value={item}>/{item}</option>)}</select>
            <select className="admin-input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="กรองสถานะเอกสาร"><option value="">ทุกสถานะ</option><option value="RECEIVED">รับเอกสารแล้ว</option><option value="PENDING">ยังไม่ได้รับ</option></select>
          </div>
          {loading ? <div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin/> กำลังโหลดข้อมูล...</div> : <div className="admin-table-wrap document-table-wrap"><table className="admin-table document-checkin-table"><thead><tr><th className="document-check-cell"><input type="checkbox" checked={allPendingSelected} disabled={!pendingOnPage.length} onChange={toggleAllPending} aria-label="เลือกนักเรียนที่ยังไม่ได้รับเอกสารทั้งหมดในหน้านี้"/></th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ชั้น / ห้อง / เลขที่</th><th>สถานะเอกสาร</th><th>ผู้รับ / วันที่รับ</th><th>จัดการ</th></tr></thead><tbody>{rows.map((row) => { const received = text(row.document_status) === "RECEIVED"; const studentId = text(row.student_id); return <tr key={studentId}><td className="document-check-cell"><input type="checkbox" disabled={received} checked={selectedIds.includes(studentId)} onChange={() => setSelectedIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId])} aria-label={`เลือก ${text(row.first_name)} ${text(row.last_name)}`}/></td><td><b>{text(row.student_code)}</b></td><td><StudentName row={row}/></td><td>{text(row.grade_level)}/{text(row.room)}{row.class_number ? ` เลขที่ ${text(row.class_number)}` : ""}</td><td><DocumentStatus row={row}/></td><td>{received ? <><b className="document-receiver">{text(row.received_by_name) || "ผู้ดูแลระบบ"}</b><small className="document-date">{formatDateTime(row.received_at)}</small></> : "—"}</td><td><div className="table-actions">{received ? canCancel && <button type="button" className="icon-button danger-icon-button" title="ยกเลิกสถานะรับเอกสาร" aria-label="ยกเลิกสถานะรับเอกสาร" onClick={() => setCancelTarget(row)}><FontAwesomeIcon icon={faXmark}/></button> : <button type="button" className="icon-button document-row-receive" disabled={busy} title="บันทึกรับเอกสาร" aria-label="บันทึกรับเอกสาร" onClick={() => void receive([studentId])}><FontAwesomeIcon icon={faCheck}/></button>}</div></td></tr>; })}</tbody></table>{!rows.length && <div className="empty-state small">ไม่พบรายการนักเรียนตามตัวกรอง</div>}<Pagination page={page} pages={totalPages} total={total} setPage={setPage}/></div>}
        </>}

        {tab === "HISTORY" && <>
          <div className="document-list-heading"><div><h2><FontAwesomeIcon icon={faHistory}/> ประวัติการตรวจรับเอกสาร</h2><p>ตรวจสอบผู้ดำเนินการ วันเวลา และเหตุผลกรณียกเลิกสถานะ</p></div></div>
          <div className="document-filters">
            <label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหารหัสหรือชื่อนักเรียน..."/></label>
            <select className="admin-input" value={grade} onChange={(event) => { setGrade(event.target.value); setRoom(""); setPage(1); }} aria-label="กรองระดับชั้น"><option value="">ทุกระดับชั้น</option>{grades.map((item) => <option key={item}>{item}</option>)}</select>
            <select className="admin-input" value={room} onChange={(event) => { setRoom(event.target.value); setPage(1); }} aria-label="กรองห้อง"><option value="">ทุกห้อง</option>{rooms.map((item) => <option key={item} value={item}>/{item}</option>)}</select>
            <select className="admin-input" value={historyAction} onChange={(event) => { setHistoryAction(event.target.value); setPage(1); }} aria-label="กรองการดำเนินการ"><option value="">ทุกการดำเนินการ</option><option value="RECEIVE">รับเอกสาร</option><option value="CANCEL">ยกเลิกสถานะ</option></select>
          </div>
          {loading ? <div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin/> กำลังโหลดประวัติ...</div> : <div className="admin-table-wrap document-table-wrap"><table className="admin-table document-history-table"><thead><tr><th>วันเวลา</th><th>นักเรียน</th><th>ชั้น / ห้อง</th><th>การดำเนินการ</th><th>ผู้ดำเนินการ</th><th>หมายเหตุ</th></tr></thead><tbody>{historyRows.map((row) => <tr key={text(row.id)}><td>{formatDateTime(row.created_at)}</td><td><b>{text(row.student_code)}</b><span><StudentName row={row}/></span></td><td>{text(row.grade_level)}/{text(row.room)}</td><td><span className={`document-event ${text(row.action).toLowerCase()}`}><FontAwesomeIcon icon={text(row.action) === "RECEIVE" ? faCircleCheck : faBan}/>{text(row.action) === "RECEIVE" ? "รับเอกสาร" : "ยกเลิกสถานะ"}</span></td><td>{text(row.processed_by_name) || "ผู้ดูแลระบบ"}</td><td>{text(row.note) || "—"}</td></tr>)}</tbody></table>{!historyRows.length && <div className="empty-state small">ยังไม่มีประวัติตามตัวกรอง</div>}<Pagination page={page} pages={historyPages} total={historyTotal} setPage={setPage}/></div>}
        </>}
      </section>

      {cancelTarget && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCancelTarget(null); }}><section className="modal document-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="document-cancel-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-icon danger-icon"><FontAwesomeIcon icon={faBan}/></div><h2 id="document-cancel-title">ยกเลิกสถานะรับเอกสาร</h2><p><StudentName row={cancelTarget}/><br/>{text(cancelTarget.grade_level)}/{text(cancelTarget.room)}</p><form onSubmit={cancelReceipt}><label className="field"><span>เหตุผลในการยกเลิก <b>*</b></span><textarea name="reason" minLength={3} maxLength={500} placeholder="เช่น บันทึกผิดคน หรือเอกสารต้องนำกลับไปแก้ไข" required/></label><div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setCancelTarget(null)}>ไม่ยกเลิก</button><button className="button danger-solid" disabled={busy}><FontAwesomeIcon icon={busy ? faSpinner : faBan} spin={busy}/> ยืนยันยกเลิก</button></div></form></section></div>}
    </>
  );
}

function Pagination({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return <nav className="table-pagination" aria-label="เปลี่ยนหน้ารายการเอกสาร"><span>แถว {first.toLocaleString("th-TH")}-{last.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))} aria-label="หน้าก่อนหน้า"><FontAwesomeIcon icon={faChevronLeft}/></button><b>หน้า {page.toLocaleString("th-TH")} / {pages.toLocaleString("th-TH")}</b><button type="button" disabled={page >= pages} onClick={() => setPage(Math.min(pages, page + 1))} aria-label="หน้าถัดไป"><FontAwesomeIcon icon={faChevronRight}/></button></div></nav>;
}
