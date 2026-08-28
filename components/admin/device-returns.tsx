"use client";

import { FormEvent, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faBoxArchive,
  faCircleCheck,
  faClockRotateLeft,
  faMagnifyingGlass,
  faSpinner,
  faTabletScreenButton,
  faTriangleExclamation,
  faUserGraduate,
  faUserTie,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";

type Row = Record<string, unknown>;
type Audience = "" | "TEACHER" | "STUDENT";
type ReturnTab = "ACTIVE" | "HISTORY";
const text = (value: unknown) => value == null ? "" : String(value);
const conditionLabels: Record<string, string> = {
  GOOD: "สภาพปกติ",
  DAMAGED: "ชำรุด",
  INCOMPLETE: "อุปกรณ์ไม่ครบ",
  OTHER: "อื่น ๆ",
};

function todayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw || "—";
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export function DeviceReturns() {
  const [active, setActive] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<Audience>("");
  const [tab, setTab] = useState<ReturnTab>("ACTIVE");
  const [selected, setSelected] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/returns");
      const body = await readJson<{ active?: Row[]; history?: Row[]; error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      setActive(body.active ?? []);
      setHistory(body.history ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดข้อมูลการคืน iPad ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  useEffect(() => {
    if (!selected) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected, busy]);

  const matches = (row: Row) => {
    if (audience && text(row.holder_type) !== audience) return false;
    const keyword = search.trim().toLocaleLowerCase("th-TH");
    if (!keyword) return true;
    return [row.holder_name,row.holder_code,row.holder_context,row.serial_number,row.asset_number]
      .some((value) => text(value).toLocaleLowerCase("th-TH").includes(keyword));
  };
  const filteredActive = active.filter(matches);
  const filteredHistory = history.filter(matches);
  const teacherActive = active.filter((row) => text(row.holder_type) === "TEACHER").length;
  const studentActive = active.filter((row) => text(row.holder_type) === "STUDENT").length;

  async function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: text(selected.assignment_id),
          holderType: text(selected.holder_type),
          returnedAt: text(form.get("returnedAt")),
          condition: text(form.get("condition")),
          note: text(form.get("note")),
        }),
      });
      const body = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      toast.success("บันทึกรับคืน iPad และเก็บประวัติแล้ว");
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกรับคืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-topline">
        <div>
          <span className="eyebrow">ระบบจัดการอุปกรณ์</span>
          <h1 className="admin-page-title"><FontAwesomeIcon icon={faArrowRotateLeft} /> คืน iPad</h1>
        </div>
      </div>

      <div className="return-summary-grid">
        <div className="return-summary teacher">
          <span><FontAwesomeIcon icon={faUserTie} /></span>
          <div><small>ครูที่ถือเครื่องอยู่</small><b>{teacherActive.toLocaleString("th-TH")}</b><em>เครื่อง</em></div>
        </div>
        <div className="return-summary student">
          <span><FontAwesomeIcon icon={faUserGraduate} /></span>
          <div><small>นักเรียนที่ถือเครื่องอยู่</small><b>{studentActive.toLocaleString("th-TH")}</b><em>เครื่อง</em></div>
        </div>
        <div className="return-summary history">
          <span><FontAwesomeIcon icon={faClockRotateLeft} /></span>
          <div><small>รับคืน / ว่าง</small><b>{history.length.toLocaleString("th-TH")}</b><em>รายการ</em></div>
        </div>
      </div>

      <section className="admin-panel device-return-panel device-return-tab-panel">
        <div className="device-return-tabs" role="tablist" aria-label="ข้อมูลการคืน iPad">
          <button type="button" role="tab" aria-selected={tab === "ACTIVE"} className={tab === "ACTIVE" ? "active" : ""} onClick={() => setTab("ACTIVE")}>
            <FontAwesomeIcon icon={faTabletScreenButton} />
            <span>เครื่องที่จัดสรรอยู่</span>
            <b>{active.length.toLocaleString("th-TH")}</b>
          </button>
          <button type="button" role="tab" aria-selected={tab === "HISTORY"} className={tab === "HISTORY" ? "active" : ""} onClick={() => setTab("HISTORY")}>
            <FontAwesomeIcon icon={faBoxArchive} />
            <span>ประวัติการคืน</span>
            <b>{history.length.toLocaleString("th-TH")}</b>
          </button>
        </div>
        {tab === "ACTIVE" ? <>
        <div className="device-return-heading">
          <div><h2><FontAwesomeIcon icon={faTabletScreenButton} /> เครื่องที่จัดสรรอยู่</h2><p>ค้นหาผู้ถือเครื่องหรือ Serial Number แล้วบันทึกรับคืน</p></div>
          <div className="device-return-filters">
            <label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ รหัส หรือ Serial Number..." /></label>
            <select className="admin-input" value={audience} onChange={(event) => setAudience(event.target.value as Audience)} aria-label="กรองประเภทผู้ถือเครื่อง">
              <option value="">ทุกประเภท</option><option value="TEACHER">ครูและบุคลากร</option><option value="STUDENT">นักเรียน</option>
            </select>
          </div>
        </div>
        {loading ? <div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin /> กำลังโหลดข้อมูล...</div> : filteredActive.length ? (
          <div className="admin-table-wrap"><table className="admin-table device-return-table"><thead><tr><th>ผู้ถือเครื่อง</th><th>ประเภท</th><th>กลุ่ม / ชั้นเรียน</th><th>Serial Number</th><th>วันที่จัดสรร</th><th>จัดการ</th></tr></thead><tbody>
            {filteredActive.map((row) => <tr key={text(row.assignment_id)}><td><b>{text(row.holder_name)}</b><small>{text(row.holder_code) || "ไม่ระบุรหัส"}</small></td><td><HolderType value={text(row.holder_type)} /></td><td>{text(row.holder_context) || "—"}</td><td><code>{text(row.serial_number) || "ยังไม่ระบุ"}</code></td><td>{formatDate(row.assigned_at)}</td><td><button className="button return-device-button" type="button" onClick={() => setSelected(row)}><FontAwesomeIcon icon={faArrowRotateLeft} /> รับคืน</button></td></tr>)}
          </tbody></table></div>
        ) : <div className="device-return-empty"><FontAwesomeIcon icon={faCircleCheck} /><h3>ไม่พบเครื่องที่รอรับคืน</h3><p>{search || audience ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "ยังไม่มีรายการจัดสรรอุปกรณ์ปัจจุบัน"}</p></div>}
        </> : <>
        <div className="device-return-heading"><div><h2><FontAwesomeIcon icon={faBoxArchive} /> ประวัติการคืนย้อนหลัง</h2><p>เก็บข้อมูลผู้คืน เครื่อง สภาพ และผู้ดำเนินการไว้ตรวจสอบย้อนหลัง</p></div><div className="device-return-filters"><label className="search-box admin-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ รหัส หรือ Serial Number..." /></label><select className="admin-input" value={audience} onChange={(event) => setAudience(event.target.value as Audience)} aria-label="กรองประเภทผู้คืน"><option value="">ทุกประเภท</option><option value="TEACHER">ครูและบุคลากร</option><option value="STUDENT">นักเรียน</option></select></div></div>
        {loading ? <div className="loading-row"><FontAwesomeIcon icon={faSpinner} spin /> กำลังโหลดประวัติ...</div> : filteredHistory.length ? (
          <div className="admin-table-wrap"><table className="admin-table return-history-table"><thead><tr><th>วันที่คืน</th><th>ผู้คืน</th><th>Serial Number</th><th>สภาพเครื่อง</th><th>หมายเหตุ</th><th>ผู้รับคืน</th></tr></thead><tbody>
            {filteredHistory.map((row) => <tr key={text(row.id)}><td><b>{formatDate(row.returned_at)}</b></td><td><b>{text(row.holder_name)}</b><small><HolderType value={text(row.holder_type)} compact /> · {text(row.holder_context) || text(row.holder_code) || "—"}</small></td><td><code>{text(row.serial_number) || "ไม่ระบุ"}</code></td><td><Condition value={text(row.device_condition)} /></td><td>{text(row.return_note) || "—"}</td><td>{text(row.processed_by_name) || "ผู้ดูแลระบบ"}</td></tr>)}
          </tbody></table></div>
        ) : <div className="device-return-empty history-empty"><FontAwesomeIcon icon={faClockRotateLeft} /><h3>ยังไม่มีประวัติการคืน</h3><p>เมื่อรับคืนเครื่อง รายการจะถูกเก็บไว้ที่นี่โดยอัตโนมัติ</p></div>}
        </>}
      </section>

      {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setSelected(null); }}><section className="modal return-device-modal" role="dialog" aria-modal="true" aria-labelledby="return-device-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="return-device-modal-header"><span><FontAwesomeIcon icon={faArrowRotateLeft} /></span><div><small>บันทึกการรับคืนอุปกรณ์</small><h2 id="return-device-title">คืน iPad</h2></div><button className="icon-button" type="button" disabled={busy} onClick={() => setSelected(null)} aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button></header>
        <div className="return-holder-card"><HolderType value={text(selected.holder_type)} /><div><b>{text(selected.holder_name)}</b><span>{text(selected.holder_context)} · รหัส {text(selected.holder_code) || "ไม่ระบุ"}</span></div><code>{text(selected.serial_number) || "ไม่ระบุ Serial Number"}</code></div>
        <div className="return-warning"><FontAwesomeIcon icon={faTriangleExclamation} /><p><b>หลังยืนยัน เครื่องจะถูกนำออกจากรายการจัดสรรปัจจุบัน</b><span>ข้อมูลการลงทะเบียนและข้อมูลบุคคลจะยังคงอยู่ ส่วนข้อมูลการคืนจะเก็บในประวัติย้อนหลัง</span></p></div>
        <form className="return-device-form" onSubmit={submitReturn}>
          <label className="field"><span>วันที่รับคืน <b>*</b></span><input type="date" name="returnedAt" defaultValue={todayInBangkok()} required /></label>
          <label className="field"><span>สภาพเครื่อง <b>*</b></span><select name="condition" defaultValue="GOOD" required><option value="GOOD">สภาพปกติ</option><option value="DAMAGED">ชำรุด</option><option value="INCOMPLETE">อุปกรณ์ไม่ครบ</option><option value="OTHER">อื่น ๆ</option></select></label>
          <label className="field full"><span>หมายเหตุการรับคืน</span><textarea name="note" className="admin-input" rows={3} placeholder="เช่น มีรอยที่มุมเครื่อง หรือขาดสายชาร์จ" /></label>
          <div className="modal-actions full"><button className="button secondary" type="button" disabled={busy} onClick={() => setSelected(null)}>ยกเลิก</button><button className="button return-confirm-button" disabled={busy}><FontAwesomeIcon icon={busy ? faSpinner : faArrowRotateLeft} spin={busy} /> {busy ? "กำลังบันทึก..." : "ยืนยันรับคืน"}</button></div>
        </form>
      </section></div>}
    </>
  );
}

function HolderType({ value, compact = false }: { value: string; compact?: boolean }) {
  const teacher = value === "TEACHER";
  return <span className={`holder-type ${teacher ? "teacher" : "student"}${compact ? " compact" : ""}`}><FontAwesomeIcon icon={teacher ? faUserTie : faUserGraduate} />{compact ? "" : teacher ? "ครูและบุคลากร" : "นักเรียน"}</span>;
}

function Condition({ value }: { value: string }) {
  return <span className={`return-condition ${value.toLowerCase()}`}><i />{conditionLabels[value] ?? value}</span>;
}
