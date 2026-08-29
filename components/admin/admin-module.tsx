"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowDown,
  faArrowUp,
  faArrowRotateRight,
  faBan,
  faBookOpen,
  faBriefcase,
  faBuildingColumns,
  faBullhorn,
  faCalendarDays,
  faCalculator,
  faChartLine,
  faChartPie,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faClock,
  faFileCsv,
  faFileExcel,
  faClipboardList,
  faFileArrowUp,
  faFilePdf,
  faFilter,
  faFloppyDisk,
  faFlask,
  faGear,
  faGripVertical,
  faImage,
  faHeartPulse,
  faLandmark,
  faLanguage,
  faListCheck,
  faLocationDot,
  faMagnifyingGlass,
  faPen,
  faPalette,
  faPeopleGroup,
  faPercent,
  faPlus,
  faPrint,
  faSpinner,
  faSchool,
  faTabletScreenButton,
  faToggleOn,
  faTrash,
  faTriangleExclamation,
  faUpload,
  faUser,
  faUserGraduate,
  faUserTie,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";
import { downloadCsv, writeXlsxRows } from "@/lib/spreadsheet-client";
import { ImportWizard } from "@/components/admin/import-wizard";
import {
  academicRankOptions,
  positionOptions,
} from "@/lib/data/teacher-options";
import { NDLP_EMAIL_PATTERN, SCHOOL_EMAIL_PATTERN } from "@/lib/validation/email-domains";

type Section =
  | "dashboard"
  | "teachers"
  | "learning-areas"
  | "results"
  | "documents"
  | "settings"
  | "audit";
type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v)),
  n = (v: unknown) => Number(v ?? 0),
  b = (v: unknown) => v === true || v === 1 || v === "1";
const learningAreaIcons: Record<string, IconDefinition> = {
  "book-open": faBookOpen,
  calculator: faCalculator,
  flask: faFlask,
  landmark: faLandmark,
  "heart-pulse": faHeartPulse,
  palette: faPalette,
  briefcase: faBriefcase,
  language: faLanguage,
  "people-group": faPeopleGroup,
  "user-tie": faUserTie,
};
const titles: Record<Section, string> = {
  dashboard: "ภาพรวมการลงทะเบียน",
  teachers: "จัดการครู",
  "learning-areas": "จัดการกลุ่มสาระ",
  results: "ลงทะเบียนครู",
  documents: "ประชาสัมพันธ์",
  settings: "ตั้งค่าระบบ",
  audit: "ประวัติการใช้งาน",
};
const sectionIcons = {
  dashboard: faChartPie,
  teachers: faUsers,
  "learning-areas": faSchool,
  results: faClipboardList,
  documents: faBullhorn,
  settings: faGear,
  audit: faListCheck,
};

export function AdminModule({ section }: { section: Section }) {
  const [data, setData] = useState<Record<string, unknown>>({}),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [auditPage, setAuditPage] = useState(1),
    [auditQuery, setAuditQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [editor, setEditor] = useState<{
      type: "teacher" | "area";
      row: Row;
    } | null>(null),
    [confirm, setConfirm] = useState<{
      message: string;
      run: () => Promise<void>;
    } | null>(null),
    [detail, setDetail] = useState<{ teacher: Row; pii: Row | null } | null>(
      null,
    ),
    [printPreviewId, setPrintPreviewId] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ resource: section });
      if (section === "audit") {
        params.set("page", String(auditPage));
        params.set("pageSize", "50");
        if (auditQuery) params.set("q", auditQuery);
      }
      const r = await fetch(`/api/admin/data?${params.toString()}`),
        body = await readJson<Record<string, unknown> & { error?: string }>(r);
      if (!r.ok) throw new Error(body.error);
      setData(body);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, auditPage, auditQuery]);
  useEffect(() => {
    if (section !== "audit") return;
    const timer = window.setTimeout(() => {
      setAuditPage(1);
      setAuditQuery(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [section, search]);
  useEffect(() => {
    if (!importOpen && !printPreviewId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImportOpen(false);
        setPrintPreviewId(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [importOpen, printPreviewId]);
  async function action(actionName: string, id?: string, payload?: Row) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionName, id, data: payload }),
        }),
        body = await readJson<Row & { error?: string }>(r);
      if (!r.ok) throw new Error(body.error);
      toast.success(
        actionName === "save-settings"
          ? "บันทึกการตั้งค่าเรียบร้อยแล้ว"
          : "บันทึกข้อมูลเรียบร้อยแล้ว",
      );
      await load();
      return body;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ",
      );
      throw error;
    } finally {
      setBusy(false);
    }
  }
  async function showDetail(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/data?resource=teacher-detail&id=${id}`),
        body = await readJson<{
          teacher: Row;
          pii: Row | null;
          error?: string;
        }>(r);
      if (!r.ok) throw new Error(body.error);
      setDetail(body);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "เปิดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  const rows = (data.rows as Row[] | undefined) ?? [],
    query = search.toLowerCase().trim(),
    filtered = query
      ? rows.filter((row) => Object.values(row).some((value) => s(value).toLowerCase().includes(query)))
      : rows;
  return (
    <>
      <div className="admin-topline">
        <div>
          <span className="eyebrow">ระบบจัดการ</span>
          <h1 className="admin-page-title">
            <FontAwesomeIcon icon={sectionIcons[section]} />
            {titles[section]}
          </h1>
        </div>
        {section === "teachers" && (
          <button
            className="button primary"
            onClick={() => setImportOpen(true)}
          >
            <FontAwesomeIcon icon={faFileArrowUp} /> นำเข้ารายชื่อ
          </button>
        )}
        {section === "learning-areas" && (
          <button
            className="button primary"
            onClick={() =>
              setEditor({
                type: "area",
                row: { icon: "book-open", is_active: 1, sort_order: 0 },
              })
            }
          >
            <FontAwesomeIcon icon={faPlus} /> เพิ่มกลุ่มสาระ
          </button>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : (
        <>
          {section === "dashboard" && <Dashboard data={data} />}
          {section === "teachers" && (
            <TeacherTable
              rows={filtered}
              areas={(data.areas as Row[]) ?? []}
              search={search}
              setSearch={setSearch}
              addTeacher={() =>
                setEditor({
                  type: "teacher",
                  row: { prefix: "นาย", is_active: 1 },
                })
              }
              edit={(row) => setEditor({ type: "teacher", row })}
              remove={(id, name) =>
                setConfirm({
                  message: `ลบหรือปิดใช้งาน ${name} หรือไม่`,
                  run: async () => {
                    await action("delete-teacher", id);
                  },
                })
              }
            />
          )}
          {section === "learning-areas" && (
            <AreaTable
              rows={filtered}
              search={search}
              setSearch={setSearch}
              edit={(row) => setEditor({ type: "area", row })}
              remove={(id, name) =>
                setConfirm({
                  message: `ลบหรือปิดใช้งานกลุ่มสาระ “${name}” หรือไม่`,
                  run: async () => {
                    await action("delete-area", id);
                  },
                })
              }
            />
          )}
          {section === "results" && (
            <ResultsTable
              rows={filtered}
              search={search}
              setSearch={setSearch}
              open={showDetail}
              print={(id) => setPrintPreviewId(id)}
              batchPrint={() => setPrintPreviewId("__batch__")}
              reload={load}
              busy={busy}
            />
          )}
          {section === "documents" && <Documents rows={rows} reload={load} />}
          {section === "settings" && (
            <Settings
              initial={(data.settings as Record<string, string>) ?? {}}
              save={(payload) => action("save-settings", undefined, payload)}
            />
          )}
          {section === "audit" && (
            <Audit
              rows={rows}
              total={n(data.total)}
              page={n(data.page) || auditPage}
              pageSize={n(data.pageSize) || 50}
              search={search}
              setSearch={setSearch}
              setPage={setAuditPage}
            />
          )}
        </>
      )}
      {editor && (
        <EditorDialog
          editor={editor}
          areas={(data.areas as Row[]) ?? []}
          busy={busy}
          close={() => setEditor(null)}
          save={async (payload) => {
            await action(
              editor.type === "teacher" ? "save-teacher" : "save-area",
              s(editor.row.id) || undefined,
              payload,
            );
            setEditor(null);
          }}
        />
      )}
      {importOpen && (
        <div
          className="modal-backdrop import-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setImportOpen(false);
          }}
        >
          <section
            className="modal import-modal"
            role="dialog"
            aria-modal="true"
            aria-label="นำเข้ารายชื่อครู"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <ImportWizard
              embedded
              onClose={() => setImportOpen(false)}
              onImported={() => void load()}
            />
          </section>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          busy={busy}
          close={() => setConfirm(null)}
          run={async () => {
            await confirm.run();
            setConfirm(null);
          }}
        />
      )}
      {detail && (
        <DetailDialog
          key={`${s(detail.teacher.id)}-${s(detail.teacher.updated_at)}`}
          value={detail}
          busy={busy}
          close={() => setDetail(null)}
          print={() => setPrintPreviewId(s(detail.teacher.id))}
          doAction={async (name, payload) => {
            await action(name, s(detail.teacher.id), payload);
            if (name === "reset-survey") {
              setDetail(null);
            } else await showDetail(s(detail.teacher.id));
          }}
        />
      )}
      {printPreviewId && (
        <PrintPreviewModal
          teacherId={printPreviewId === "__batch__" ? undefined : printPreviewId}
          batch={printPreviewId === "__batch__"}
          close={() => setPrintPreviewId(null)}
        />
      )}
    </>
  );
}
function Loading() {
  return (
    <div className="admin-panel">
      <div className="loading-row">
        <FontAwesomeIcon icon={faSpinner} spin /> กำลังโหลดข้อมูล...
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 48, borderRadius: 12, marginTop: 8 }}
        />
      ))}
    </div>
  );
}
function Dashboard({ data }: { data: Record<string, unknown> }) {
  const [audience, setAudience] = useState<"teachers" | "students">("teachers");
  const teacherTotals = (data.teacherTotals as Row) ?? {},
    studentTotals = (data.studentTotals as Row) ?? {},
    settings = (data.settings as Record<string, string>) ?? {},
    isStudent = audience === "students",
    totals = isStudent ? studentTotals : teacherTotals,
    total = n(totals.total),
    responded = n(totals.responded),
    accepted = n(totals.accepted),
    declined = n(totals.declined),
    configuredQuota = Number(
      settings[isStudent ? "student_ipad_quota" : "teacher_ipad_quota"] ??
        (isStudent ? 1763 : 127),
    ),
    quota = Number.isSafeInteger(configuredQuota) && configuredQuota >= 0
      ? configuredQuota
      : isStudent ? 1763 : 127,
    assigned = n(data[isStudent ? "studentAssigned" : "teacherAssigned"]),
    remaining = Math.max(0, quota - assigned),
    allocationRate = quota ? Math.min(100, Math.round((assigned / quota) * 100)) : 0,
    rate = total ? Math.round((responded / total) * 100) : 0,
    areas = (data.areas as Row[]) ?? [],
    studentGrades = (data.studentGrades as Row[]) ?? [];
  const cards = [
    { label: isStudent ? "นักเรียนทั้งหมด" : "ครูทั้งหมด", value: total, icon: isStudent ? faUserGraduate : faUserTie, color: "#1599d6" },
    { label: "ลงทะเบียนแล้ว", value: responded, icon: faCircleCheck, color: "#0f9b8e" },
    { label: "ยังไม่ลงทะเบียน", value: total - responded, icon: faClock, color: "#f4b942" },
    { label: "รับ iPad", value: accepted, icon: faTabletScreenButton, color: "#12b8c8" },
    { label: "ไม่รับ iPad", value: declined, icon: faBan, color: "#e79b29" },
    { label: "อัตราลงทะเบียน", value: `${rate}%`, icon: faPercent, color: "#0b6fb8" },
  ];
  return (
    <>
      <div className="dashboard-tabs" role="tablist" aria-label="เลือกภาพรวมการลงทะเบียน">
        <button className={audience === "teachers" ? "active teacher-tab" : "teacher-tab"} type="button" role="tab" aria-selected={audience === "teachers"} onClick={() => setAudience("teachers")}>
          <FontAwesomeIcon icon={faUserTie} />
          <span><b>ครูและบุคลากร</b><small>{n(teacherTotals.total)} คน</small></span>
        </button>
        <button className={audience === "students" ? "active student-tab" : "student-tab"} type="button" role="tab" aria-selected={audience === "students"} onClick={() => setAudience("students")}>
          <FontAwesomeIcon icon={faUserGraduate} />
          <span><b>นักเรียน</b><small>{n(studentTotals.total)} คน</small></span>
        </button>
      </div>
      <section
        className={`ipad-availability ${isStudent ? "student" : "teacher"}`}
        aria-label={`iPad คงเหลือสำหรับ${isStudent ? "นักเรียน" : "ครูและบุคลากร"} ${remaining} เครื่อง`}
      >
        <span className="ipad-availability-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTabletScreenButton} />
        </span>
        <div className="ipad-availability-copy">
          <strong>iPad คงเหลือสำหรับ{isStudent ? "นักเรียน" : "ครูและบุคลากร"}</strong>
          <span>กำลังใช้งาน {assigned.toLocaleString("th-TH")} จากโควตา {quota.toLocaleString("th-TH")} เครื่อง</span>
          <div className="ipad-availability-meter" aria-hidden="true">
            <i style={{ width: `${allocationRate}%` }} />
          </div>
        </div>
        <div className="ipad-availability-count">
          <b>{remaining.toLocaleString("th-TH")}</b>
          <small>เครื่อง</small>
        </div>
      </section>
      <div className="kpi-grid">
        {cards.map((card) => (
          <div className="kpi" key={card.label}>
            <div className="kpi-top">
              <span>{card.label}</span>
              <span
                className="kpi-icon"
                style={{ color: card.color, background: `${card.color}18` }}
              >
                <FontAwesomeIcon icon={card.icon} />
              </span>
            </div>
            <b>{card.value}</b>
            <i style={{ background: card.color }} />
          </div>
        ))}
      </div>
      {isStudent
        ? <ResponseChart title="สถานะนักเรียนแยกตามระดับชั้น" rows={studentGrades} unit="นักเรียน" empty="ยังไม่มีข้อมูลนักเรียน" />
        : <ResponseChart title="สถานะครูแยกตามกลุ่มสาระ" rows={areas} unit="ครู" empty="ยังไม่มีข้อมูลครู" />}
    </>
  );
}
function ResponseChart({ title, rows, unit, empty }: { title: string; rows: Row[]; unit: string; empty: string }) {
  return (
      <div className="admin-panel response-chart-panel dashboard-chart-section">
        <div className="response-chart-heading">
          <h2>
            <FontAwesomeIcon icon={faChartLine} /> {title}
          </h2>
          <div className="response-chart-legend" aria-label="คำอธิบายสีกราฟ">
            <span><i className="accepted" />รับ iPad</span>
            <span><i className="declined" />ไม่รับ iPad</span>
            <span><i className="pending" />ยังไม่ลงทะเบียน</span>
          </div>
        </div>
        {rows.length ? (
          <div className="response-chart-grid">
          {rows.map((area, index) => {
            const sum = n(area.total),
              acceptedCount = n(area.accepted),
              declinedCount = n(area.declined),
              pendingCount = Math.max(0, sum - acceptedCount - declinedCount),
              acceptedWidth = sum ? (acceptedCount / sum) * 100 : 0,
              declinedWidth = sum ? (declinedCount / sum) * 100 : 0,
              pendingWidth = sum ? (pendingCount / sum) * 100 : 100;
            return (
              <div className="response-chart-row" key={s(area.id) || `${s(area.name)}-${index}`}>
                <div className="response-chart-label">
                  <span className="response-chart-area-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={learningAreaIcons[s(area.icon)] ?? (unit === "นักเรียน" ? faUserGraduate : faBookOpen)} />
                  </span>
                  <div>
                    <b>{s(area.name)}</b>
                    <span>{unit}ทั้งหมด {sum} คน</span>
                  </div>
                </div>
                <div className="response-chart-data">
                  <div
                    className="response-chart-track"
                    role="img"
                    aria-label={`${s(area.name)} รับ iPad ${acceptedCount} คน ไม่รับ iPad ${declinedCount} คน และยังไม่ลงทะเบียน ${pendingCount} คน`}
                  >
                    <i
                      className="accepted"
                      style={{ width: `${acceptedWidth}%` }}
                    />
                    <i
                      className="declined"
                      style={{ width: `${declinedWidth}%` }}
                    />
                    <i
                      className="pending"
                      style={{ width: `${pendingWidth}%` }}
                    />
                  </div>
                  <div className="response-chart-counts">
                    <span><i className="accepted" />รับ <b>{acceptedCount}</b></span>
                    <span><i className="declined" />ไม่รับ <b>{declinedCount}</b></span>
                    <span><i className="pending" />ไม่ตอบ <b>{pendingCount}</b></span>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        ) : (
          <Empty text={empty} />
        )}
      </div>
  );
}
function Toolbar({
  search,
  setSearch,
  children,
  searchRight = false,
  className = "",
}: {
  search: string;
  setSearch: (v: string) => void;
  children?: React.ReactNode;
  searchRight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`toolbar${searchRight ? " search-right" : ""}${className ? ` ${className}` : ""}`}
    >
      <label className="search-box admin-search">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input
          placeholder="ค้นหา..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="toolbar-group">{children}</div>
    </div>
  );
}
function TeacherTable({
  rows,
  areas,
  search,
  setSearch,
  addTeacher,
  edit,
  remove,
}: {
  rows: Row[];
  areas: Row[];
  search: string;
  setSearch: (v: string) => void;
  addTeacher: () => void;
  edit: (r: Row) => void;
  remove: (id: string, name: string) => void;
}) {
  const [areaFilter, setAreaFilter] = useState("");
  const visibleRows = areaFilter
    ? rows.filter((row) => s(row.learning_area_id) === areaFilter)
    : rows;
  return (
    <div className="admin-panel">
      <Toolbar search={search} setSearch={setSearch} searchRight>
        <label className="admin-area-filter">
          <FontAwesomeIcon icon={faFilter} aria-hidden="true" />
          <select
            aria-label="กรองครูตามกลุ่มสาระ"
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
          >
            <option value="">ทุกกลุ่มสาระ</option>
            {areas.map((area) => (
              <option key={s(area.id)} value={s(area.id)}>
                {s(area.name)}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary compact-button" onClick={addTeacher}>
          <FontAwesomeIcon icon={faPlus} /> เพิ่มครู
        </button>
      </Toolbar>
      {visibleRows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชื่อครู</th>
                <th>กลุ่มสาระ</th>
                <th>ตำแหน่ง</th>
                <th>ความประสงค์</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={s(row.id)}>
                  <td>
                    <b>
                      {s(row.prefix)}
                      {s(row.first_name)} {s(row.last_name)}
                    </b>
                    <br />
                    <small>{s(row.teacher_code) || "ไม่มีรหัสบุคลากร"}</small>
                  </td>
                  <td>{s(row.learning_area)}</td>
                  <td>
                    {s(row.position)} {s(row.academic_rank)}
                  </td>
                  <td>
                    <Status value={s(row.survey_status)} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        title="แก้ไข"
                        onClick={() => edit(row)}
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        className="icon-button"
                        title="ลบ"
                        onClick={() =>
                          remove(
                            s(row.id),
                            `${s(row.first_name)} ${s(row.last_name)}`,
                          )
                        }
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text={rows.length ? "ไม่พบครูตามตัวกรอง" : "ยังไม่มีรายชื่อครู"} />
      )}
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        กลุ่มสาระที่ใช้งานอยู่ {areas.length} กลุ่ม · แสดง {visibleRows.length} รายการ
      </p>
    </div>
  );
}
function AreaTable({
  rows,
  search,
  setSearch,
  edit,
  remove,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  edit: (r: Row) => void;
  remove: (id: string, name: string) => void;
}) {
  return (
    <div className="admin-panel">
      <Toolbar search={search} setSearch={setSearch} />
      {rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>รหัส</th>
                <th>ชื่อกลุ่มสาระ</th>
                <th>จำนวนครู</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={s(row.id)}>
                  <td>{n(row.sort_order)}</td>
                  <td>{s(row.code)}</td>
                  <td>
                    <b>{s(row.name)}</b>
                  </td>
                  <td>{n(row.teacher_count)} คน</td>
                  <td>
                    <span
                      className={`badge ${b(row.is_active) ? "accept" : "pending"}`}
                    >
                      <FontAwesomeIcon icon={b(row.is_active) ? faCircleCheck : faBan} />
                      {b(row.is_active) ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="icon-button" onClick={() => edit(row)}>
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => remove(s(row.id), s(row.name))}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="ยังไม่มีกลุ่มสาระ" />
      )}
    </div>
  );
}
function ResultsTable({
  rows,
  search,
  setSearch,
  open,
  print,
  batchPrint,
  reload,
  busy,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  open: (id: string) => void;
  print: (id: string) => void;
  batchPrint: () => void;
  reload: () => void;
  busy: boolean;
}) {
  const [areaFilter, setAreaFilter] = useState("ALL"),
    [filter, setFilter] = useState("ALL"),
    areas = Array.from(
      new Set(rows.map((row) => s(row.learning_area)).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right, "th")),
    shown = rows.filter((row) => {
      const matchesArea =
          areaFilter === "ALL" || s(row.learning_area) === areaFilter,
        matchesStatus =
          filter === "ALL" ||
          (filter === "PENDING"
            ? !row.decision
            : s(row.decision) === filter);

      return matchesArea && matchesStatus;
    });
  const total=rows.length,
    responded=rows.filter(row=>Boolean(row.decision)).length,
    accepted=rows.filter(row=>s(row.decision)==="ACCEPT").length,
    declined=rows.filter(row=>s(row.decision)==="DECLINE").length,
    stats=[
      {label:"ครูทั้งหมด",value:total,icon:faUsers,color:"#1599d6"},
      {label:"ลงทะเบียนแล้ว",value:responded,icon:faCircleCheck,color:"#0f9b8e"},
      {label:"รับ iPad",value:accepted,icon:faTabletScreenButton,color:"#12b8c8"},
      {label:"ไม่รับ iPad",value:declined,icon:faBan,color:"#e79b29"},
      {label:"ยังไม่ลงทะเบียน",value:Math.max(0,total-responded),icon:faClock,color:"#f4b942"},
    ];
  async function exportData(type: "summary" | "full", format: "csv" | "xlsx") {
    const r = await fetch(`/api/admin/export?type=${type}`),
      body = await readJson<{ error?: string; rows: Row[] }>(r);
    if (!r.ok) {
      toast.error(body.error);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") await writeXlsxRows(body.rows, `ipad-survey-${date}.xlsx`);
    else downloadCsv(body.rows, `ipad-survey-${date}.csv`);
    toast.success("เตรียมไฟล์ส่งออกแล้ว");
    reload();
  }
  return (
    <>
      <div className="student-admin-kpis student-results-kpis teacher-results-kpis">
        {stats.map(item=><div className="kpi" key={item.label}><div className="kpi-top"><span>{item.label}</span><span className="kpi-icon" style={{color:item.color,background:`${item.color}18`}}><FontAwesomeIcon icon={item.icon}/></span></div><b>{item.value}</b><i style={{background:item.color}}/></div>)}
      </div>
      <div className="admin-panel">
      <div className="results-table-heading"><div><h2><FontAwesomeIcon icon={faClipboardList}/> รายการลงทะเบียนครู</h2><p>แสดง {shown.length} จาก {rows.length} รายการ</p></div><div className="result-icon-actions"><button className="icon-button csv-action" type="button" disabled={busy} onClick={() => exportData("summary", "csv")} aria-label="ดาวน์โหลด Summary CSV" title="ดาวน์โหลด Summary CSV"><FontAwesomeIcon icon={faFileCsv}/></button><button className="icon-button xlsx-action" type="button" disabled={busy} onClick={() => exportData("full", "xlsx")} aria-label="ดาวน์โหลด Full XLSX" title="ดาวน์โหลด Full XLSX"><FontAwesomeIcon icon={faFileExcel}/></button><button className="icon-button print-action" type="button" onClick={batchPrint} aria-label="พิมพ์ AWAT-03 แบบชุด" title="พิมพ์ AWAT-03 แบบชุด"><FontAwesomeIcon icon={faPrint}/></button></div></div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        className="results-toolbar"
      >
        <select
          className="admin-input results-area-filter"
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          aria-label="กรองตามกลุ่มสาระ"
        >
          <option value="ALL">ทุกกลุ่มสาระ</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        <select
          className="admin-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="กรองตามสถานะ"
        >
          <option value="ALL">ทุกสถานะ</option>
          <option value="ACCEPT">รับ iPad</option>
          <option value="DECLINE">ไม่รับ iPad</option>
          <option value="PENDING">ยังไม่ลงทะเบียน</option>
        </select>
      </Toolbar>
      {shown.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชื่อครู</th>
                <th>กลุ่มสาระ</th>
                <th>สถานะ</th>
                <th>วันที่ตอบ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={s(row.id)}>
                  <td>
                    <b>
                      {s(row.prefix)}
                      {s(row.first_name)} {s(row.last_name)}
                    </b>
                  </td>
                  <td>{s(row.learning_area)}</td>
                  <td>
                    <Status value={s(row.decision) || "PENDING"} />
                  </td>
                  <td>
                    {row.submitted_at
                      ? new Date(s(row.submitted_at)).toLocaleString("th-TH")
                      : "—"}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        onClick={() => open(s(row.id))}
                        aria-label="ดูรายละเอียด"
                        title="ดูรายละเอียด"
                      >
                        <FontAwesomeIcon icon={faUser} />
                      </button>
                      {s(row.decision) === "ACCEPT" && (
                        <button
                          className="icon-button"
                          onClick={() => print(s(row.id))}
                          aria-label="พิมพ์แบบฟอร์ม AWAT-03"
                          title="พิมพ์แบบฟอร์ม AWAT-03"
                        >
                          <FontAwesomeIcon icon={faPrint} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="ไม่พบรายการลงทะเบียนครู" />
      )}
      </div>
    </>
  );
}
function PrintPreviewModal({
  teacherId,
  batch = false,
  close,
}: {
  teacherId?: string;
  batch?: boolean;
  close: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  return (
    <div
      className="modal-backdrop print-preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="modal print-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="print-preview-header">
          <div>
            <span className="eyebrow">ตัวอย่างเอกสาร</span>
            <h2 id="print-preview-title">{batch ? "แบบฟอร์ม AWAT-03 แบบชุด" : "แบบฟอร์ม AWAT-03"}</h2>
          </div>
          <div className="print-preview-actions">
            <button
              className="button primary"
              onClick={() => frame.current?.contentWindow?.print()}
            >
              <FontAwesomeIcon icon={faPrint} /> พิมพ์เอกสาร
            </button>
            <button
              className="icon-button"
              onClick={close}
              aria-label="ปิดตัวอย่างเอกสาร"
              title="ปิด"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </header>
        <iframe
          ref={frame}
          title={batch ? "ตัวอย่างแบบฟอร์ม AWAT-03 แบบชุด" : "ตัวอย่างแบบฟอร์ม AWAT-03"}
          src={batch ? "/admin/print/batch?embed=1" : `/admin/print/${teacherId}?embed=1`}
        />
      </section>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const cls =
      value === "ACCEPT"
        ? "accept"
        : value === "DECLINE"
          ? "decline"
          : "pending",
    text =
      value === "ACCEPT"
        ? "รับ iPad"
        : value === "DECLINE"
          ? "ไม่รับ iPad"
          : "ยังไม่ลงทะเบียน";
  const icon =
    value === "ACCEPT"
      ? faCircleCheck
      : value === "DECLINE"
        ? faBan
        : faClock;
  return <span className={`badge ${cls}`}><FontAwesomeIcon icon={icon} />{text}</span>;
}
function Documents({ rows, reload }: { rows: Row[]; reload: () => void }) {
  const [busy, setBusy] = useState(false),
    [selectedFiles, setSelectedFiles] = useState<File[]>([]),
    [uploadProgress, setUploadProgress] = useState(""),
    [ordering, setOrdering] = useState(false),
    [editRow, setEditRow] = useState<PublicationRow | null>(null),
    [editExistingFiles, setEditExistingFiles] = useState<Row[]>([]),
    [editFiles, setEditFiles] = useState<File[]>([]),
    [editReplacementFiles, setEditReplacementFiles] = useState<Record<string, File>>({});
  type PublicationRow = Row & { _documents: Row[] };
  const groupedRows = Array.from(
    rows
      .reduce((groups, row) => {
        const groupId = s(row.publication_group_id) || s(row.id);
        const current = groups.get(groupId);
        if (current) {
          current._documents.push(row);
          current.size_bytes = n(current.size_bytes) + n(row.size_bytes);
          current.file_count = n(current.file_count) + 1;
        } else {
          groups.set(groupId, {
            ...row,
            publication_group_id: groupId,
            size_bytes: n(row.size_bytes),
            file_count: 1,
            _documents: [row],
          });
        }
        return groups;
      }, new Map<string, PublicationRow>())
      .values(),
  );
  const selectedFilesAreImages =
    selectedFiles.length > 0 &&
    selectedFiles.every(
      (file) =>
        file.type.startsWith("image/") ||
        /\.(?:jpe?g|png|webp|gif)$/i.test(file.name),
    );
  useEffect(() => {
    if (!editRow) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setEditRow(null);
        setEditExistingFiles([]);
        setEditFiles([]);
        setEditReplacementFiles({});
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editRow, busy]);
  function encodeUploadHeader(value: string) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/g, "");
  }
  async function fileSignature(file: File) {
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function filesAreSupported(files: File[]) {
    return !(
      files.length > 1 &&
      files.some(
        (file) =>
          !file.type.startsWith("image/") &&
          !/\.(?:jpe?g|png|webp|gif)$/i.test(file.name),
      )
    );
  }
  function fileIsImage(file: File) {
    return (
      file.type.startsWith("image/") ||
      /\.(?:jpe?g|png|webp|gif)$/i.test(file.name)
    );
  }
  function reorderItems<T>(items: T[], from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length)
      return items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }
  async function uploadFiles(
    files: File[],
    title: string,
    description: string,
    requestedGroupId = "",
  ) {
    let groupId = requestedGroupId;
    let firstId = "";
    const ids: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress(files.length > 1 ? `${index + 1}/${files.length}` : "");
        const r = await fetch("/api/admin/documents", {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-Upload-Title": encodeUploadHeader(title),
            "X-Upload-Description": encodeUploadHeader(description),
            "X-Upload-Filename": encodeUploadHeader(file.name),
            "X-Upload-Signature": await fileSignature(file),
            ...(groupId
              ? { "X-Publication-Group-Id": encodeUploadHeader(groupId) }
              : {}),
          },
          body: file,
        });
        const body = await readJson<{
          error?: string;
          id?: string;
          groupId?: string;
        }>(r);
        if (!r.ok) throw new Error(body.error);
        firstId = firstId || body.id || "";
        if (body.id) ids.push(body.id);
        groupId = body.groupId ?? groupId;
      }
    } catch (error) {
      if (requestedGroupId) {
        await Promise.all(
          ids.map((documentId) =>
            fetch(`/api/admin/documents/${documentId}?attachment=1`, {
              method: "DELETE",
            }).catch(() => undefined),
          ),
        );
      } else if (firstId) {
        await fetch(`/api/admin/documents/${firstId}`, { method: "DELETE" }).catch(
          () => undefined,
        );
      }
      throw error;
    }
    if (!firstId || !groupId) throw new Error("ระบบไม่สามารถสร้างรายการประชาสัมพันธ์ได้");
    return { firstId, groupId, ids };
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const fileInput = formElement.elements.namedItem("file");
    const files =
      selectedFiles.length > 0
        ? selectedFiles
        : fileInput instanceof HTMLInputElement
          ? Array.from(fileInput.files ?? [])
          : [];
    if (!files.length) {
      toast.warning("กรุณาเลือกไฟล์รูปภาพหรือ PDF");
      return;
    }
    if (!filesAreSupported(files)) {
      toast.warning("การแนบหลายไฟล์รองรับรูปภาพเท่านั้น ส่วน PDF ให้อัปโหลดแยกรายการ");
      return;
    }
    const titleInput = formElement.elements.namedItem("title");
    const descriptionInput = formElement.elements.namedItem("description");
    const title = titleInput instanceof HTMLInputElement ? titleInput.value : "";
    const description =
      descriptionInput instanceof HTMLTextAreaElement
        ? descriptionInput.value
        : "";
    setBusy(true);
    try {
      await uploadFiles(files, title, description);
      toast.success(
        files.length > 1
          ? `อัปโหลดประชาสัมพันธ์ ${files.length} รูปสำเร็จ`
          : "อัปโหลดไฟล์ประชาสัมพันธ์สำเร็จ",
      );
      formElement.reset();
      setSelectedFiles([]);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      setUploadProgress("");
    }
  }
  async function updateDocument(id: string, payload: Row) {
    const r = await fetch(`/api/admin/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await readJson<{ error?: string }>(r);
    if (!r.ok) throw new Error(body.error);
  }
  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editRow) return;
    const form = new FormData(e.currentTarget);
    const title = s(form.get("title")).trim();
    const description = s(form.get("description")).trim();
    const isActive = form.get("isActive") === "on";
    if (!title) {
      toast.warning("กรุณาระบุชื่อประชาสัมพันธ์");
      return;
    }
    const groupId = s(editRow.publication_group_id) || s(editRow.id);
    const finalFileTypes = [
      ...editExistingFiles.map((document) => {
        const replacement = editReplacementFiles[s(document.id)];
        return replacement
          ? fileIsImage(replacement)
          : s(document.mime_type).startsWith("image/");
      }),
      ...editFiles.map(fileIsImage),
    ];
    if (!finalFileTypes.length) {
      toast.warning("รายการประชาสัมพันธ์ต้องเหลือไฟล์อย่างน้อย 1 ไฟล์");
      return;
    }
    if (
      !filesAreSupported([
        ...Object.values(editReplacementFiles),
        ...editFiles,
      ]) ||
      (finalFileTypes.length > 1 && finalFileTypes.some((isImage) => !isImage))
    ) {
      toast.warning("รายการหลายไฟล์รองรับรูปภาพเท่านั้น ส่วน PDF ต้องมีเพียง 1 ไฟล์");
      return;
    }
    setBusy(true);
    const uploadedIds: string[] = [];
    let deletionStarted = false;
    try {
      const replacementIds = new Map<string, string>();
      for (const document of editExistingFiles) {
        const documentId = s(document.id);
        const replacementFile = editReplacementFiles[documentId];
        if (!replacementFile) continue;
        const uploaded = await uploadFiles(
          [replacementFile],
          title,
          description,
          groupId,
        );
        uploadedIds.push(...uploaded.ids);
        replacementIds.set(documentId, uploaded.firstId);
      }
      const additions = editFiles.length
        ? await uploadFiles(editFiles, title, description, groupId)
        : null;
      if (additions) uploadedIds.push(...additions.ids);

      const retainedIds = new Set(editExistingFiles.map((document) => s(document.id)));
      const removedIds = editRow._documents
        .map((document) => s(document.id))
        .filter(
          (documentId) =>
            !retainedIds.has(documentId) || replacementIds.has(documentId),
        );
      const orderedIds = [
        ...editExistingFiles.map(
          (document) => replacementIds.get(s(document.id)) ?? s(document.id),
        ),
        ...(additions?.ids ?? []),
      ];
      await updateDocument(orderedIds[0], {
        title,
        description,
        sortOrder: n(editRow.sort_order),
        isActive,
      });
      const reorderResponse = await fetch("/api/admin/documents/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          orderedAttachmentIds: orderedIds,
        }),
      });
      const reorderBody = await readJson<{ error?: string }>(reorderResponse);
      if (!reorderResponse.ok) throw new Error(reorderBody.error);

      deletionStarted = removedIds.length > 0;
      for (const documentId of removedIds) {
        const response = await fetch(
          `/api/admin/documents/${documentId}?attachment=1`,
          { method: "DELETE" },
        );
        const body = await readJson<{ error?: string }>(response);
        if (!response.ok) throw new Error(body.error);
      }

      toast.success("บันทึกไฟล์และข้อมูลประชาสัมพันธ์แล้ว");
      setEditRow(null);
      setEditExistingFiles([]);
      setEditFiles([]);
      setEditReplacementFiles({});
      reload();
    } catch (error) {
      if (!deletionStarted) {
        await Promise.all(
          uploadedIds.map((documentId) =>
            fetch(`/api/admin/documents/${documentId}?attachment=1`, {
              method: "DELETE",
            }).catch(() => undefined),
          ),
        );
      }
      toast.error(error instanceof Error ? error.message : "แก้ไขประชาสัมพันธ์ไม่สำเร็จ");
    } finally {
      setBusy(false);
      setUploadProgress("");
    }
  }
  async function patchDoc(row: Row, changes: Row) {
    const r = await fetch(`/api/admin/documents/${s(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: s(row.title),
          description: s(row.description),
          sortOrder: n(row.sort_order),
          isActive: b(row.is_active),
          ...changes,
        }),
      }),
      body = await readJson<{ error?: string }>(r);
    if (!r.ok) {
      toast.error(body.error);
      return;
    }
    toast.success("อัปเดตประชาสัมพันธ์แล้ว");
    reload();
  }
  async function moveDocument(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (ordering || targetIndex < 0 || targetIndex >= groupedRows.length) return;
    const orderedRows = [...groupedRows];
    [orderedRows[index], orderedRows[targetIndex]] = [
      orderedRows[targetIndex],
      orderedRows[index],
    ];
    setOrdering(true);
    try {
      const r = await fetch("/api/admin/documents/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderedIds: orderedRows.map((row) => s(row.publication_group_id)),
          }),
        }),
        body = await readJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(body.error);
      toast.success("เปลี่ยนลำดับการแสดงผลแล้ว");
      reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "เปลี่ยนลำดับไม่สำเร็จ",
      );
    } finally {
      setOrdering(false);
    }
  }
  async function remove(row: Row) {
    const r = await fetch(`/api/admin/documents/${s(row.id)}`, {
        method: "DELETE",
      }),
      body = await readJson<{ error?: string }>(r);
    if (!r.ok) toast.error(body.error);
    else {
      toast.success("ลบเอกสารแล้ว");
      reload();
    }
  }
  return (
    <div className="documents-admin-layout">
      <form className="admin-panel document-upload-card" onSubmit={upload}>
        <div className="document-card-heading">
          <span className="document-heading-icon">
            <FontAwesomeIcon icon={faFileArrowUp} />
          </span>
          <div>
            <h2>เพิ่มประชาสัมพันธ์</h2>
            <p>แนบรูปภาพให้แสดงบนหน้าเว็บ หรือแนบ PDF สำหรับเปิดอ่านและดาวน์โหลด</p>
          </div>
        </div>
        <div className="document-upload-fields">
          <label className="field">
            <span>ชื่อเรื่อง</span>
            <input name="title" placeholder="เช่น ประกาศรับลงทะเบียน iPad" required />
          </label>
          <label className="field document-file-field">
            <span>ไฟล์รูปภาพหรือ PDF</span>
            <span className="document-file-picker">
              <span className={`document-file-icon${selectedFilesAreImages ? " image" : ""}`}>
                <FontAwesomeIcon icon={selectedFilesAreImages ? faImage : faFilePdf} />
              </span>
              <span className="document-file-copy">
                <b>
                  {selectedFiles.length > 1
                    ? `เลือกแล้ว ${selectedFiles.length} รูป`
                    : selectedFiles[0]?.name || "เลือกไฟล์รูปภาพหรือ PDF"}
                </b>
                <small>เลือกหลายรูปในครั้งเดียวได้ หรือเลือก PDF 1 ไฟล์</small>
              </span>
              <span className="document-file-button">เลือกไฟล์</span>
              <input
              name="file"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp,.gif"
              onChange={(event) => {
                setSelectedFiles(Array.from(event.target.files ?? []));
              }}
            />
            </span>
          </label>
          <DocumentFilePreviews
            files={selectedFiles}
            onMove={(from, to) =>
              setSelectedFiles((current) => reorderItems(current, from, to))
            }
            onRemove={(index) =>
              setSelectedFiles((current) =>
                current.filter((_, fileIndex) => fileIndex !== index),
              )
            }
          />
          <label className="field">
            <span>คำอธิบาย <small>(ไม่บังคับ)</small></span>
            <textarea
              name="description"
              className="admin-input"
              placeholder="สรุปรายละเอียดสั้น ๆ ที่ต้องการประชาสัมพันธ์"
            />
          </label>
        </div>
        <div className="document-upload-actions">
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> กำลังอัปโหลด{uploadProgress ? ` ${uploadProgress}` : ""}...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faUpload} /> อัปโหลดไฟล์
              </>
            )}
          </button>
        </div>
      </form>
      <section className="admin-panel document-list-card">
        <div className="document-list-heading">
          <div>
            <h2>รายการประชาสัมพันธ์</h2>
            <p>จัดการรูปภาพและเอกสารที่แสดงบนหน้าเว็บ</p>
          </div>
          <span>{groupedRows.length} รายการ</span>
        </div>
        {groupedRows.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ประชาสัมพันธ์</th>
                  <th>ขนาด</th>
                  <th>สถานะ</th>
                  <th>วันที่อัปโหลด</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((row, index) => (
                  <tr key={s(row.id)}>
                    <td>
                      <b>
                        <FontAwesomeIcon icon={s(row.mime_type).startsWith("image/") ? faImage : faFilePdf} /> {s(row.title)}
                      </b>
                      {n(row.file_count) > 1 && (
                        <span className="publication-file-count">
                          {n(row.file_count)} รูป
                        </span>
                      )}
                      <br />
                      <small>{s(row.description)}</small>
                    </td>
                    <td>{(n(row.size_bytes) / 1024 / 1024).toFixed(2)} MB</td>
                    <td>
                      <button
                        className={`badge ${b(row.is_active) ? "accept" : "pending"}`}
                        onClick={() =>
                          patchDoc(row, { isActive: !b(row.is_active) })
                        }
                      >
                        <FontAwesomeIcon icon={b(row.is_active) ? faCircleCheck : faBan} />
                        {b(row.is_active) ? "เผยแพร่" : "ซ่อน"}
                      </button>
                    </td>
                    <td>
                      {new Date(s(row.created_at)).toLocaleDateString("th-TH")}
                    </td>
                    <td>
                      <div className="document-row-actions">
                        <div className="document-order-actions" aria-label="จัดลำดับการแสดงผล">
                          <button
                            type="button"
                            className="icon-button"
                            disabled={ordering || index === 0}
                            onClick={() => void moveDocument(index, -1)}
                            aria-label={`เลื่อน ${s(row.title)} ขึ้น`}
                            title="เลื่อนขึ้น"
                          >
                            <FontAwesomeIcon icon={faArrowUp} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            disabled={ordering || index === groupedRows.length - 1}
                            onClick={() => void moveDocument(index, 1)}
                            aria-label={`เลื่อน ${s(row.title)} ลง`}
                            title="เลื่อนลง"
                          >
                            <FontAwesomeIcon icon={faArrowDown} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          disabled={ordering}
                          onClick={() => {
                            setEditRow(row);
                            setEditExistingFiles(
                              [...row._documents].sort(
                                (left, right) =>
                                  n(left.attachment_order) - n(right.attachment_order),
                              ),
                            );
                            setEditFiles([]);
                            setEditReplacementFiles({});
                          }}
                          aria-label={`แก้ไข ${s(row.title)}`}
                          title="แก้ไขประชาสัมพันธ์"
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger-icon-button"
                          disabled={ordering}
                          onClick={() => remove(row)}
                          aria-label={`ลบ ${s(row.title)}`}
                          title="ลบรายการ"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="document-empty-state">
            <span>
              <FontAwesomeIcon icon={faImage} />
            </span>
            <h3>ยังไม่มีรายการประชาสัมพันธ์</h3>
            <p>รูปภาพหรือเอกสารที่อัปโหลดจะแสดงอยู่บริเวณนี้</p>
          </div>
        )}
      </section>
      {editRow && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setEditRow(null);
              setEditExistingFiles([]);
              setEditFiles([]);
              setEditReplacementFiles({});
            }
          }}
        >
          <section
            className="modal document-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="document-editor-header">
              <div>
                <span><FontAwesomeIcon icon={faBullhorn} /></span>
                <div>
                  <small>ประชาสัมพันธ์</small>
                  <h2 id="document-editor-title">แก้ไขรายการ</h2>
                </div>
              </div>
              <button
                className="icon-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditRow(null);
                  setEditExistingFiles([]);
                  setEditFiles([]);
                  setEditReplacementFiles({});
                }}
                aria-label="ปิด"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>
            <form className="document-editor-form" onSubmit={saveEdit}>
              <label className="field">
                <span>ชื่อเรื่อง <b>*</b></span>
                <input name="title" defaultValue={s(editRow.title)} maxLength={200} required />
              </label>
              <label className="field">
                <span>คำอธิบาย <small>(ไม่บังคับ)</small></span>
                <textarea
                  name="description"
                  className="admin-input"
                  defaultValue={s(editRow.description)}
                  maxLength={1000}
                  placeholder="สรุปรายละเอียดสั้น ๆ ที่ต้องการประชาสัมพันธ์"
                />
              </label>
              <ExistingDocumentPreviews
                files={editExistingFiles}
                replacements={editReplacementFiles}
                onMove={(from, to) =>
                  setEditExistingFiles((current) => reorderItems(current, from, to))
                }
                onRemove={(index) => {
                  const documentId = s(editExistingFiles[index]?.id);
                  setEditExistingFiles((current) =>
                    current.filter((_, fileIndex) => fileIndex !== index),
                  );
                  if (documentId) {
                    setEditReplacementFiles((current) => {
                      const next = { ...current };
                      delete next[documentId];
                      return next;
                    });
                  }
                }}
                onReplace={(documentId, file) =>
                  setEditReplacementFiles((current) => ({
                    ...current,
                    [documentId]: file,
                  }))
                }
              />
              <label className="field document-file-field">
                <span>เพิ่มไฟล์หรือรูป <small>(ไม่บังคับ)</small></span>
                <span className="document-file-picker">
                  <span className={`document-file-icon${editFiles.length ? " image" : ""}`}>
                    <FontAwesomeIcon icon={editFiles.length ? faImage : faFilePdf} />
                  </span>
                  <span className="document-file-copy">
                    <b>
                      {editFiles.length > 1
                        ? `เลือกเพิ่ม ${editFiles.length} รูป`
                        : editFiles[0]?.name || "เพิ่มรูปในรายการนี้"}
                    </b>
                    <small>รูปที่เลือกใหม่จะต่อท้ายรูปเดิมและยังจัดลำดับได้</small>
                  </span>
                  <span className="document-file-button">เลือกไฟล์เพิ่ม</span>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={(event) => setEditFiles(Array.from(event.target.files ?? []))}
                  />
                </span>
              </label>
              <DocumentFilePreviews
                files={editFiles}
                onMove={(from, to) =>
                  setEditFiles((current) => reorderItems(current, from, to))
                }
                onRemove={(index) =>
                  setEditFiles((current) =>
                    current.filter((_, fileIndex) => fileIndex !== index),
                  )
                }
                addition
              />
              <label className="document-editor-status">
                <input name="isActive" type="checkbox" defaultChecked={b(editRow.is_active)} />
                <span aria-hidden="true" />
                <div>
                  <b>เผยแพร่บนหน้าเว็บ</b>
                  <small>ปิดสวิตช์เมื่อต้องการซ่อนรายการชั่วคราว</small>
                </div>
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setEditRow(null);
                    setEditExistingFiles([]);
                    setEditFiles([]);
                    setEditReplacementFiles({});
                  }}
                >
                  ยกเลิก
                </button>
                <button className="button primary" disabled={busy}>
                  <FontAwesomeIcon icon={busy ? faSpinner : faFloppyDisk} spin={busy} />
                  {busy
                    ? `กำลังบันทึก${uploadProgress ? ` ${uploadProgress}` : ""}...`
                    : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function ExistingDocumentPreviews({
  files,
  replacements,
  onMove,
  onRemove,
  onReplace,
}: {
  files: Row[];
  replacements: Record<string, File>;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onReplace: (documentId: string, file: File) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const replacementPreviews = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(replacements).map(([documentId, file]) => [
          documentId,
          file.type.startsWith("image/") || /\.(?:jpe?g|png|webp|gif)$/i.test(file.name)
            ? URL.createObjectURL(file)
            : "",
        ]),
      ),
    [replacements],
  );
  useEffect(
    () => () => {
      Object.values(replacementPreviews).forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [replacementPreviews],
  );
  if (!files.length) return null;
  return (
    <section className="document-selected-section" aria-label="รูปและไฟล์ปัจจุบัน">
      <header>
        <div>
          <b>รูปและไฟล์ปัจจุบัน</b>
          <small>รูปเดิมแสดงครบทุกภาพ เปลี่ยนเฉพาะรูป ลบ หรือจัดลำดับได้ทันที</small>
        </div>
        <span>{files.length} ไฟล์</span>
      </header>
      <div className="document-selected-grid">
        {files.map((document, index) => {
          const documentId = s(document.id);
          const replacement = replacements[documentId];
          const replacementPreview = replacementPreviews[documentId];
          const isImage = replacement
            ? Boolean(replacementPreview)
            : s(document.mime_type).startsWith("image/");
          return (
            <article
              key={documentId}
              className={`document-selected-item${dragIndex === index ? " is-dragging" : ""}`}
              draggable={files.length > 1}
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(event) => {
                if (files.length > 1) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
                if (Number.isInteger(from)) onMove(from, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <span className="document-selected-order">{index + 1}</span>
              <div className="document-selected-preview">
                {isImage ? (
                  // Existing files use the authenticated admin file endpoint; replacements use a local preview URL.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={replacementPreview || `/api/admin/documents/${documentId}/file`}
                    alt={`รูปปัจจุบันลำดับที่ ${index + 1}`}
                    draggable={false}
                  />
                ) : (
                  <FontAwesomeIcon icon={faFilePdf} />
                )}
              </div>
              <div className="document-selected-meta">
                <b>{replacement ? `รูปใหม่ลำดับที่ ${index + 1}` : isImage ? `รูปที่ ${index + 1}` : "เอกสาร PDF"}</b>
                <small>
                  {replacement
                    ? `${(replacement.size / 1024 / 1024).toFixed(2)} MB · รอแทนที่`
                    : `${(n(document.size_bytes) / 1024 / 1024).toFixed(2)} MB`}
                </small>
              </div>
              {files.length > 1 && (
                <span className="document-drag-handle" title="ลากเพื่อสลับลำดับ">
                  <FontAwesomeIcon icon={faGripVertical} />
                </span>
              )}
              <div className="document-selected-actions">
                {files.length > 1 && (
                  <>
                    <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`เลื่อนรูปที่ ${index + 1} ขึ้น`}>
                      <FontAwesomeIcon icon={faArrowUp} />
                    </button>
                    <button type="button" disabled={index === files.length - 1} onClick={() => onMove(index, index + 1)} aria-label={`เลื่อนรูปที่ ${index + 1} ลง`}>
                      <FontAwesomeIcon icon={faArrowDown} />
                    </button>
                  </>
                )}
                <label className="document-replace-button" title="เปลี่ยนเฉพาะไฟล์นี้">
                  <FontAwesomeIcon icon={faPen} />
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onReplace(documentId, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button type="button" className="remove" onClick={() => onRemove(index)} aria-label={`ลบไฟล์ที่ ${index + 1}`}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function DocumentFilePreviews({
  files,
  onMove,
  onRemove,
  addition = false,
}: {
  files: File[];
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  addition?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const previews = useMemo(
    () =>
      files.map((file) =>
        file.type.startsWith("image/") || /\.(?:jpe?g|png|webp|gif)$/i.test(file.name)
          ? URL.createObjectURL(file)
          : "",
      ),
    [files],
  );
  useEffect(
    () => () => {
      previews.forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [previews],
  );
  if (!files.length) return null;
  return (
    <section className="document-selected-section" aria-label="ตัวอย่างไฟล์ที่เลือก">
      <header>
        <div>
          <b>{addition ? "ไฟล์ที่จะเพิ่ม" : "ตัวอย่างก่อนอัปโหลด"}</b>
          <small>
            {files.length > 1
              ? "ลากการ์ดเพื่อเรียงรูปที่จะแสดงก่อน–หลัง"
              : "ตรวจสอบรูปหรือเอกสารก่อนบันทึก"}
          </small>
        </div>
        <span>{files.length} ไฟล์</span>
      </header>
      <div className="document-selected-grid">
        {files.map((file, index) => {
          const preview = previews[index];
          return (
            <article
              key={`${file.name}-${file.lastModified}-${index}`}
              className={`document-selected-item${dragIndex === index ? " is-dragging" : ""}`}
              draggable={files.length > 1}
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(event) => {
                if (files.length > 1) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragIndex ?? Number(event.dataTransfer.getData("text/plain"));
                if (Number.isInteger(from)) onMove(from, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <span className="document-selected-order">{index + 1}</span>
              <div className="document-selected-preview">
                {preview ? (
                  // The image is a temporary local object URL selected by the admin.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt={`ตัวอย่างรูปที่ ${index + 1}`}
                    draggable={false}
                  />
                ) : (
                  <FontAwesomeIcon icon={faFilePdf} />
                )}
              </div>
              <div className="document-selected-meta">
                <b>{preview ? `รูปที่ ${index + 1}` : "เอกสาร PDF"}</b>
                <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
              </div>
              {files.length > 1 && (
                <span className="document-drag-handle" title="ลากเพื่อสลับลำดับ">
                  <FontAwesomeIcon icon={faGripVertical} />
                </span>
              )}
              <div className="document-selected-actions">
                {files.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMove(index, index - 1)}
                      aria-label={`เลื่อนรูปที่ ${index + 1} ขึ้น`}
                    >
                      <FontAwesomeIcon icon={faArrowUp} />
                    </button>
                    <button
                      type="button"
                      disabled={index === files.length - 1}
                      onClick={() => onMove(index, index + 1)}
                      aria-label={`เลื่อนรูปที่ ${index + 1} ลง`}
                    >
                      <FontAwesomeIcon icon={faArrowDown} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="remove"
                  onClick={() => onRemove(index)}
                  aria-label={`นำไฟล์ที่ ${index + 1} ออก`}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function registrationScheduleText(opensAt?: string, closesAt?: string) {
  const format = (value: string) => new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
  if (opensAt && closesAt) return `เปิด ${format(opensAt)} ถึง ${format(closesAt)}`;
  if (opensAt) return `เริ่มเปิดอัตโนมัติ ${format(opensAt)}`;
  if (closesAt) return `ปิดอัตโนมัติ ${format(closesAt)}`;
  return "ยังไม่กำหนดเวลา ระบบจะใช้สถานะจากสวิตช์";
}
function Settings({
  initial,
  save,
}: {
  initial: Record<string, string>;
  save: (p: Row) => Promise<unknown>;
}) {
  const [values, setValues] = useState(initial),
    [savedValues, setSavedValues] = useState(initial),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [logoBusy, setLogoBusy] = useState(false),
    [logoVersion, setLogoVersion] = useState(0);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const fields: Array<[string, string, string, IconDefinition]> = [
    ["system_name", "ชื่อระบบ", "text", faGear],
    ["project_name", "ชื่อโครงการ", "text", faClipboardList],
    ["school_name", "ชื่อโรงเรียน", "text", faSchool],
    ["subdistrict", "ตำบล", "text", faLocationDot],
    ["district", "อำเภอ", "text", faLocationDot],
    ["province", "จังหวัด", "text", faLocationDot],
    ["organization", "หน่วยงานต้นสังกัด", "text", faBuildingColumns],
    ["device_brand", "ยี่ห้ออุปกรณ์", "text", faTabletScreenButton],
    ["device_model", "รุ่นอุปกรณ์", "text", faTabletScreenButton],
    ["teacher_ipad_quota", "จำนวน iPad สำหรับครูและบุคลากร", "number", faTabletScreenButton],
    ["student_ipad_quota", "จำนวน iPad สำหรับนักเรียน", "number", faTabletScreenButton],
    ["teacher_approver_name", "ผู้อนุมัติเอกสารครู", "text", faUserTie],
    ["student_approver_name", "ผู้อนุมัติเอกสารนักเรียน", "text", faUserGraduate],
  ];
  const heroFields: Array<[string, string]> = [
    ["hero_eyebrow", "ป้ายเหนือหัวข้อ"],
    ["hero_title", "หัวข้อบรรทัดแรก"],
    ["hero_product_name", "ชื่ออุปกรณ์"],
    ["hero_product_suffix", "ข้อความต่อท้ายชื่ออุปกรณ์"],
    ["hero_free_label", "ป้ายข้อความเด่น"],
    ["hero_audience", "ข้อความกลุ่มผู้ลงทะเบียน"],
  ];
  async function uploadLogo(file: File, input: HTMLInputElement) {
    setLogoBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/logo", {
          method: "POST",
          body: form,
        }),
        body = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error);
      setLogoVersion(Date.now());
      window.dispatchEvent(new Event("school-logo-updated"));
      toast.success("เปลี่ยนโลโก้โรงเรียนแล้ว");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "เปลี่ยนโลโก้ไม่สำเร็จ",
      );
    } finally {
      input.value = "";
      setLogoBusy(false);
    }
  }
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => firstFieldRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const editableValues = Object.fromEntries([
      ...fields.map(([key]) => [key, values[key] ?? ""]),
      ...heroFields.map(([key]) => [key, values[key] ?? ""]),
      ["teacher_survey_status", values.teacher_survey_status ?? values.survey_status ?? "OPEN"],
      ["student_survey_status", values.student_survey_status ?? values.survey_status ?? "OPEN"],
      ["teacher_registration_opens_at", values.teacher_registration_opens_at ?? ""],
      ["teacher_registration_closes_at", values.teacher_registration_closes_at ?? ""],
      ["student_registration_opens_at", ""],
      ["student_registration_closes_at", ""],
      ["student_lower_survey_status", values.student_lower_survey_status ?? values.student_survey_status ?? values.survey_status ?? "OPEN"],
      ["student_lower_registration_opens_at", values.student_lower_registration_opens_at || values.student_registration_opens_at || ""],
      ["student_lower_registration_closes_at", values.student_lower_registration_closes_at || values.student_registration_closes_at || ""],
      ["student_upper_survey_status", values.student_upper_survey_status ?? values.student_survey_status ?? values.survey_status ?? "OPEN"],
      ["student_upper_registration_opens_at", values.student_upper_registration_opens_at || values.student_registration_opens_at || ""],
      ["student_upper_registration_closes_at", values.student_upper_registration_closes_at || values.student_registration_closes_at || ""],
      ["announcement", values.announcement ?? ""],
    ]);
    try {
      await save(editableValues);
      setSavedValues(editableValues);
      setValues(editableValues);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      key={editing ? "settings-editing" : "settings-locked"}
      data-mode={editing ? "editing" : "locked"}
      className={`admin-panel settings-grid ${editing ? "is-editing" : "is-locked"}`}
      onSubmit={submit}
    >
      <div className="setting-section settings-section-first">
        <h3>
          <FontAwesomeIcon icon={faImage} /> โลโก้โรงเรียน
        </h3>
      </div>
      <div className="settings-logo-card full">
        <span className="settings-logo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/public/logo?v=${logoVersion}`}
            alt="ตัวอย่างโลโก้โรงเรียน"
          />
        </span>
        <div className="settings-logo-copy">
          <b>โลโก้ที่ใช้ในระบบ</b>
          <p>รองรับไฟล์ PNG, JPG และ WebP ขนาดไม่เกิน 5 MB</p>
          <label
            className={`button secondary settings-logo-button${logoBusy || !editing ? " disabled" : ""}`}
          >
            <FontAwesomeIcon icon={logoBusy ? faSpinner : faUpload} spin={logoBusy} />
            {logoBusy
              ? "กำลังอัปโหลด..."
              : editing
                ? "เปลี่ยนโลโก้"
                : "กดแก้ไขเพื่อเปลี่ยนโลโก้"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              disabled={logoBusy || !editing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file, event.currentTarget);
              }}
            />
          </label>
        </div>
      </div>
      <div className="setting-section">
        <h3>
          <FontAwesomeIcon icon={faGear} /> ข้อมูลระบบและโครงการ
        </h3>
      </div>
      {fields.map(([key, label, type, icon]) => (
        <label
          className={`field ${key === "system_name" || key === "project_name" || key === "organization" ? "full" : ""}`}
          key={key}
        >
          <span className="settings-field-label">
            <FontAwesomeIcon icon={icon} /> {label}
          </span>
          <input
            ref={key === "system_name" ? firstFieldRef : undefined}
            type={type}
            min={type === "number" ? 0 : undefined}
            step={type === "number" ? 1 : undefined}
            value={values[key] ?? ""}
            disabled={!editing || busy}
            onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))}
          />
        </label>
      ))}
      <div className="setting-section">
        <h3>
          <FontAwesomeIcon icon={faBullhorn} /> ข้อความ Hero หน้าแรก
        </h3>
      </div>
      {heroFields.map(([key, label]) => (
        <label
          className={`field ${key === "hero_audience" ? "full" : ""}`}
          key={key}
        >
          <span className="settings-field-label">
            <FontAwesomeIcon icon={faPen} /> {label}
          </span>
          <input
            type="text"
            value={values[key] ?? ""}
            disabled={!editing || busy}
            maxLength={key === "hero_audience" ? 160 : 80}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                [key]: event.target.value,
              }))
            }
          />
        </label>
      ))}
      <div className="setting-section">
        <h3>
          <FontAwesomeIcon icon={faToggleOn} /> การเปิดรับลงทะเบียน
        </h3>
      </div>
      <div className="registration-window-grid full">
        {([
          ["teacher", "ครูและบุคลากร", faUserTie, "teacher-registration-window"],
          ["student_lower", "นักเรียน ม.ต้น", faUserGraduate, "student-registration-window"],
          ["student_upper", "นักเรียน ม.ปลาย", faUserGraduate, "student-registration-window"],
        ] as const).map(([audience, label, icon, className]) => {
          const statusKey = `${audience}_survey_status`;
          const opensKey = `${audience}_registration_opens_at`;
          const closesKey = `${audience}_registration_closes_at`;
          const isStudentTier = audience.startsWith("student_");
          const enabled = (values[statusKey] ?? (audience.startsWith("student_") ? values.student_survey_status : undefined) ?? values.survey_status ?? "OPEN") === "OPEN";
          const opensAt = values[opensKey] || (isStudentTier ? values.student_registration_opens_at : "") || "";
          const closesAt = values[closesKey] || (isStudentTier ? values.student_registration_closes_at : "") || "";
          return (
            <section className={`registration-window-card ${className}`} key={audience}>
              <header>
                <span><FontAwesomeIcon icon={icon} /></span>
                <div><small>กำหนดช่วงเวลาลงทะเบียน</small><h4>{label}</h4></div>
              </header>
              <label className="registration-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!editing || busy}
                  onChange={(event) => setValues({ ...values, [statusKey]: event.target.checked ? "OPEN" : "CLOSED" })}
                />
                <i aria-hidden="true" />
                <span><b>{enabled ? "เปิดรับลงทะเบียน" : "ปิดรับลงทะเบียน"}</b><small>ใช้สวิตช์นี้เมื่อต้องการเปิดหรือปิดทันที</small></span>
              </label>
              <div className="registration-datetime-grid">
                <label className="field"><span><FontAwesomeIcon icon={faCalendarDays} /> วัน–เวลาเปิด</span><input type="datetime-local" value={opensAt} disabled={!editing || busy} onChange={(event) => setValues({ ...values, [opensKey]: event.target.value })} /></label>
                <label className="field"><span><FontAwesomeIcon icon={faClock} /> วัน–เวลาปิด</span><input type="datetime-local" value={closesAt} disabled={!editing || busy} onChange={(event) => setValues({ ...values, [closesKey]: event.target.value })} /></label>
              </div>
              <p className="registration-window-note"><FontAwesomeIcon icon={faClock} /> {registrationScheduleText(opensAt, closesAt)}</p>
            </section>
          );
        })}
      </div>
      <label className="field full settings-announcement-field">
        <span className="settings-field-label">
          <FontAwesomeIcon icon={faBullhorn} /> ข้อความประกาศหน้าแรก
        </span>
        <textarea
          className="admin-input"
          name="announcement"
          rows={3}
          value={values.announcement ?? ""}
          readOnly={!editing || busy}
          aria-readonly={!editing || busy}
          onChange={(e) =>
            setValues((current) => ({ ...current, announcement: e.target.value }))
          }
        />
      </label>
      <div className={`settings-form-actions full ${editing ? "is-editing" : "is-locked"}`}>
        {editing ? (
          <>
          <button className="button primary settings-save-button" disabled={busy || logoBusy}>
            {busy ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> กำลังบันทึก...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faFloppyDisk} /> บันทึกการตั้งค่า
              </>
            )}
          </button>
          <button
            type="button"
            className="button secondary settings-cancel-button"
            disabled={busy || logoBusy}
            onClick={() => {
              setValues(savedValues);
              setEditing(false);
            }}
          >
            <FontAwesomeIcon icon={faXmark} /> ยกเลิก
          </button>
          </>
        ) : (
          <button
            type="button"
            className="button secondary settings-edit-button"
            onClick={() => {
              setValues({ ...savedValues });
              setEditing(true);
            }}
          >
            <FontAwesomeIcon icon={faPen} /> แก้ไขการตั้งค่า
          </button>
        )}
      </div>
    </form>
  );
}
function Audit({
  rows,
  total,
  page,
  pageSize,
  search,
  setSearch,
  setPage,
}: {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  setSearch: (v: string) => void;
  setPage: (v: number | ((current: number) => number)) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total ? (page - 1) * pageSize + 1 : 0;
  const lastShown = Math.min(page * pageSize, total);
  return (
    <div className="admin-panel">
      <Toolbar search={search} setSearch={setSearch} />
      {rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>วันเวลา</th>
                <th>ผู้ดำเนินการ</th>
                <th>เหตุการณ์</th>
                <th>ประเภท</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={s(row.id)}>
                  <td>{new Date(s(row.created_at)).toLocaleString("th-TH")}</td>
                  <td>{s(row.display_name) || "ระบบ"}</td>
                  <td>
                    <b>{s(row.action)}</b>
                  </td>
                  <td>{s(row.entity_type)}</td>
                  <td>{s(row.description)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > pageSize && (
            <nav className="table-pagination" aria-label="เปลี่ยนหน้าประวัติการใช้งาน">
              <span>
                รายการ {firstShown.toLocaleString("th-TH")}-
                {lastShown.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")}
              </span>
              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="หน้าก่อนหน้า"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <b>
                  หน้า {page.toLocaleString("th-TH")} / {totalPages.toLocaleString("th-TH")}
                </b>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  aria-label="หน้าถัดไป"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </nav>
          )}
        </div>
      ) : (
        <Empty text="ยังไม่มีประวัติการใช้งาน" />
      )}
    </div>
  );
}
function EditorDialog({
  editor,
  areas,
  busy,
  close,
  save,
}: {
  editor: { type: "teacher" | "area"; row: Row };
  areas: Row[];
  busy: boolean;
  close: () => void;
  save: (p: Row) => Promise<void>;
}) {
  const row = editor.row,
    [form, setForm] = useState<Row>(
      editor.type === "teacher"
        ? {
            prefix: s(row.prefix) || "นาย",
            firstName: s(row.first_name),
            lastName: s(row.last_name),
            learningAreaId: s(row.learning_area_id),
            position: positionOptions.some(
              (position) => position === s(row.position),
            )
              ? s(row.position)
              : "",
            academicRank: s(row.academic_rank),
            email: s(row.email),
            ndlpEmail: s(row.ndlp_email),
            phone: s(row.phone),
            sortOrder: n(row.sort_order),
            isActive: row.is_active === undefined ? true : b(row.is_active),
          }
        : {
            code: s(row.code),
            name: s(row.name),
            icon: s(row.icon) || "book-open",
            sortOrder: n(row.sort_order),
            isActive: row.is_active === undefined ? true : b(row.is_active),
          },
    );
  const input = (
    key: string,
    label: string,
    required = false,
    type: "text" | "email" | "tel" = "text",
  ) => (
    <label className="field">
      <span>{label}{required && <b>*</b>}</span>
      <input
        type={type}
        required={required}
        value={s(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="modal-backdrop">
      <form
        className={`modal editor-modal${editor.type === "teacher" ? " teacher-editor-modal" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          void save(form);
        }}
      >
        <h2 className="dialog-title">
          <FontAwesomeIcon icon={row.id ? faPen : faPlus} />
          {row.id ? "แก้ไข" : "เพิ่ม"}
          {editor.type === "teacher" ? "ข้อมูลครู" : "กลุ่มสาระ"}
        </h2>
        <div className="admin-form-grid" style={{ textAlign: "left" }}>
          {editor.type === "teacher" ? (
            <>
              <p className="admin-form-hint full">
                ระบบจะสร้างรหัสบุคลากรให้อัตโนมัติ อีเมลและเบอร์โทรศัพท์เว้นไว้ให้ครูกรอกตอนลงทะเบียนได้
              </p>
              <label className="field">
                <span>คำนำหน้า<b>*</b></span>
                <select
                  required
                  value={s(form.prefix)}
                  onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                >
                  <option>นาย</option>
                  <option>นาง</option>
                  <option>นางสาว</option>
                  <option>ดร.</option>
                </select>
              </label>
              {input("firstName", "ชื่อ", true)}
              {input("lastName", "นามสกุล", true)}
              <label className="field">
                <span>กลุ่มสาระ<b>*</b></span>
                <select
                  required
                  value={s(form.learningAreaId)}
                  onChange={(e) =>
                    setForm({ ...form, learningAreaId: e.target.value })
                  }
                >
                  <option value="">เลือกกลุ่มสาระ</option>
                  {areas.map((a) => (
                    <option key={s(a.id)} value={s(a.id)}>
                      {s(a.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>ตำแหน่ง</span>
                <select
                  value={s(form.position)}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                >
                  <option value="">ให้ครูกรอกภายหลัง</option>
                  {positionOptions.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>วิทยฐานะ</span>
                <select
                  value={s(form.academicRank)}
                  onChange={(e) =>
                    setForm({ ...form, academicRank: e.target.value })
                  }
                >
                  <option value="">ให้ครูกรอกภายหลัง</option>
                  {academicRankOptions.map((rank) => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>อีเมลโรงเรียน</span>
                <input type="email" pattern={SCHOOL_EMAIL_PATTERN} title="ต้องใช้อีเมล @chomthong.ac.th" placeholder="name@chomthong.ac.th" value={s(form.email)} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="field">
                <span>อีเมล NDLP</span>
                <input type="email" pattern={NDLP_EMAIL_PATTERN} title="ต้องใช้อีเมล @ndlp.go.th" placeholder="name@ndlp.go.th" value={s(form.ndlpEmail)} onChange={(e) => setForm({ ...form, ndlpEmail: e.target.value })} />
                <small className="field-hint">หากลืมอีเมล NDLP ให้ติดต่อครูวิทยา หรือครูธนา</small>
              </label>
              {input("phone", "เบอร์โทรศัพท์", false, "tel")}
            </>
          ) : (
            <>
              {input("code", "รหัสกลุ่มสาระ", true)}
              {input("name", "ชื่อกลุ่มสาระ", true)}
              {input("icon", "ชื่อไอคอน")}
              {input("sortOrder", "ลำดับ")}
            </>
          )}
          <label className="admin-active-toggle full">
            <input
              type="checkbox"
              checked={b(form.isActive)}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span className="admin-toggle-track" aria-hidden="true" />
            <span>{b(form.isActive) ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
          </label>
        </div>
        <div className="modal-actions">
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> กำลังบันทึก...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faFloppyDisk} /> บันทึก
              </>
            )}
          </button>
          <button type="button" className="button secondary" onClick={close}>
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}
function ConfirmDialog({
  message,
  busy,
  close,
  run,
}: {
  message: string;
  busy: boolean;
  close: () => void;
  run: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon" style={{ color: "var(--danger)" }}>
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>
        <h2>ยืนยันการดำเนินการ</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="button secondary" onClick={close}>
            ยกเลิก
          </button>
          <button className="button danger" disabled={busy} onClick={run}>
            {busy ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <FontAwesomeIcon icon={faTrash} />
            )}{" "}
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
function DetailDialog({
  value,
  busy,
  close,
  print,
  doAction,
}: {
  value: { teacher: Row; pii: Row | null };
  busy: boolean;
  close: () => void;
  print: () => void;
  doAction: (name: string, payload?: Row) => Promise<void>;
}) {
  const t = value.teacher,
    p = value.pii;
  const initialForm = {
    decision: s(t.decision) || "PENDING",
    phone: s(t.phone),
    citizenId: p ? s(p.citizenId) : "",
    houseNo: p ? s(p.houseNo) : "",
    moo: p ? s(p.moo) : "",
    soi: p ? s(p.soi) : "",
    road: p ? s(p.road) : "",
    subdistrict: p ? s(p.subdistrict) : "",
    district: p ? s(p.district) : "",
    province: p ? s(p.province) : "",
    postalCode: p ? s(p.postalCode) : "",
    assetNumber: s(t.asset_number),
    serialNumber: s(t.serial_number),
  };
  const [editing, setEditing] = useState(false),
    [form, setForm] = useState(initialForm);
  const editField = (
    key: keyof typeof initialForm,
    label: string,
    options: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        {...options}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </label>
  );
  async function saveDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doAction("save-teacher-detail", {
      decision: form.decision === "PENDING" ? "" : form.decision,
      phone: form.phone,
      pii:
        form.decision === "ACCEPT"
          ? {
              citizenId: form.citizenId,
              houseNo: form.houseNo,
              moo: form.moo,
              soi: form.soi,
              road: form.road,
              subdistrict: form.subdistrict,
              district: form.district,
              province: form.province,
              postalCode: form.postalCode,
            }
          : undefined,
      assetNumber: form.assetNumber,
      serialNumber: form.serialNumber,
      assignedAt: s(t.assigned_at),
      hasDevice: Boolean(t.asset_number || t.serial_number),
    });
    setEditing(false);
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal detail-modal"
        style={{
          width: "min(820px,100%)",
          textAlign: "left",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div className="toolbar">
          <div>
            <span className="eyebrow">ข้อมูลครูและการลงทะเบียน</span>
            <h2 className="dialog-title">
              <FontAwesomeIcon icon={faUser} />
              {s(t.prefix)}
              {s(t.first_name)} {s(t.last_name)}
            </h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="ปิด">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        {editing ? (
          <form className="detail-edit-form" onSubmit={saveDetail}>
            <div className="admin-form-grid">
              <label className="field">
                <span>ความประสงค์</span>
                <select
                  value={form.decision}
                  disabled={!t.decision}
                  onChange={(event) =>
                    setForm({ ...form, decision: event.target.value })
                  }
                >
                  <option value="PENDING">ยังไม่ลงทะเบียน</option>
                  <option value="ACCEPT">รับ iPad</option>
                  <option value="DECLINE">ไม่รับ iPad</option>
                </select>
              </label>
              {editField("phone", "เบอร์โทรศัพท์", {
                inputMode: "tel",
                maxLength: 10,
              })}
              {form.decision === "ACCEPT" && (
                <>
                  {editField("citizenId", "เลขประจำตัวประชาชน / รหัส G", {
                    inputMode: "text",
                    maxLength: 13,
                    placeholder: "เลข 13 หลัก หรือ G ตามด้วยเลข 12 หลัก",
                  })}
                  {editField("houseNo", "บ้านเลขที่")}
                  {editField("moo", "หมู่")}
                  {editField("soi", "ซอย")}
                  {editField("road", "ถนน")}
                  {editField("subdistrict", "ตำบล/แขวง")}
                  {editField("district", "อำเภอ/เขต")}
                  {editField("province", "จังหวัด")}
                  {editField("postalCode", "รหัสไปรษณีย์", {
                    inputMode: "numeric",
                    maxLength: 5,
                  })}
                </>
              )}
              {editField("assetNumber", "เลขครุภัณฑ์")}
              {editField("serialNumber", "Serial Number")}
            </div>
            <div className="detail-edit-actions">
              <button className="button primary" disabled={busy}>
                <FontAwesomeIcon icon={faFloppyDisk} />
                {busy ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setForm(initialForm);
                  setEditing(false);
                }}
              >
                ยกเลิก
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="admin-form-grid">
              <Info label="กลุ่มสาระ" value={s(t.learning_area)} />
              <Info label="ความประสงค์" value={s(t.decision) || "ยังไม่ลงทะเบียน"} />
              <Info label="อีเมลโรงเรียน" value={s(t.email) || "—"} />
              <Info label="อีเมล NDLP" value={s(t.ndlp_email) || "—"} />
              <Info label="เลขประจำตัวประชาชน" value={p ? s(p.citizenId) : "—"} />
              <Info label="เบอร์โทรศัพท์" value={s(t.phone) || "—"} />
              <Info
                label="ที่อยู่"
                value={
                  p
                    ? `${s(p.houseNo)} หมู่ ${s(p.moo)} ซอย ${s(p.soi)} ถนน ${s(p.road)} ต.${s(p.subdistrict)} อ.${s(p.district)} จ.${s(p.province)} ${s(p.postalCode)}`
                    : "—"
                }
              />
              <Info
                label="อุปกรณ์"
                value={
                  [s(t.asset_number), s(t.serial_number)]
                    .filter(Boolean)
                    .join(" · ") || "ยังไม่ได้จัดสรร"
                }
              />
            </div>
            <div className="toolbar detail-toolbar" style={{ marginTop: 24 }}>
              <div className="toolbar-group">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
                  <FontAwesomeIcon icon={faPen} /> แก้ไขข้อมูล
                </button>
                <button
                  className="button secondary"
                  onClick={print}
                >
                  <FontAwesomeIcon icon={faPrint} /> พิมพ์ AWAT03
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !t.decision}
                  onClick={() => doAction("reopen-survey")}
                >
                  <FontAwesomeIcon icon={faArrowRotateRight} /> เปิดให้ครูแก้ไข
                </button>
                <button
                  className="button danger"
                  disabled={busy || !t.decision}
                  onClick={() => doAction("reset-survey")}
                >
                  <FontAwesomeIcon icon={faTrash} /> เปิดให้ลงทะเบียนใหม่
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <small style={{ color: "var(--muted)" }}>{label}</small>
      <div style={{ fontWeight: 700, marginTop: 4, overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <FontAwesomeIcon icon={faUsers} />
      <h3>{text}</h3>
    </div>
  );
}
