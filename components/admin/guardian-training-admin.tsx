"use client";
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faEye,
  faFilter,
  faForward,
  faGraduationCap,
  faMagnifyingGlass,
  faRedo,
  faShieldHalved,
  faSpinner,
  faUserCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";

type Row = Record<string, unknown>;
const text = (value: unknown) => (value == null ? "" : String(value)),
  number = (value: unknown) => Number(value ?? 0);
const labels: Record<string, string> = {
  ASSIGNED: "ต้องอบรม",
  IN_PROGRESS: "กำลังรับชม",
  VIDEO_COMPLETED: "รอทำข้อสอบ",
  QUIZ_FAILED: "ต้องอบรมใหม่",
  QUIZ_PASSED: "ผ่านข้อสอบ",
  REVIEW_PENDING: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ให้ส่งใหม่",
  EXEMPT: "ยกเว้นการอบรม",
};

export function GuardianTrainingAdmin() {
  const [rows, setRows] = useState<Row[]>([]),
    [options, setOptions] = useState<Row[]>([]),
    [summary, setSummary] = useState<Row>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [grade, setGrade] = useState(""),
    [room, setRoom] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [review, setReview] = useState<Row | null>(null),
    [rejecting, setRejecting] = useState(false),
    [note, setNote] = useState("");
  const rooms = useMemo(
    () =>
      options
        .filter((item) => !grade || text(item.grade_level) === grade)
        .map((item) => text(item.room))
        .filter((value, index, array) => array.indexOf(value) === index),
    [options, grade],
  );
  const grades = useMemo(
    () =>
      options
        .map((item) => text(item.grade_level))
        .filter((value, index, array) => array.indexOf(value) === index),
    [options],
  );
  const pages = Math.max(1, Math.ceil(total / 50));
  async function load() {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (search) query.set("search", search);
      if (grade) query.set("grade", grade);
      if (room) query.set("room", room);
      if (status) query.set("status", status);
      const response = await fetch(`/api/admin/training?${query}`, {
        cache: "no-store",
      });
      const data = await readJson<{
        rows: Row[];
        options: Row[];
        summary: Row;
        total: number;
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(data.error);
      setRows(data.rows);
      setOptions(data.options);
      setSummary(data.summary);
      setTotal(data.total);
      setSelected([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [page, search, grade, room, status]);
  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ success?: boolean; error?: string }>(
        response,
      );
      if (!response.ok) throw new Error(data.error);
      toast.success(success);
      setReview(null);
      setRejecting(false);
      setNote("");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  const selectable = rows.map((row) => text(row.student_id));
  const allSelected =
    selectable.length > 0 && selectable.every((id) => selected.includes(id));
  function toggleAll() {
    setSelected(allSelected ? [] : selectable);
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void load();
  }
  return (
    <div className="admin-page training-admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">GUARDIAN TRAINING</span>
          <h1>
            <FontAwesomeIcon icon={faGraduationCap} /> อบรมผู้ปกครอง
          </h1>
          <p>
            นักเรียนที่ยังไม่รับเครื่องต้องผ่านการอบรมทุกคน
            ยกเว้นรายที่ผู้ดูแลอนุมัติเป็นกรณีพิเศษ
          </p>
        </div>
      </div>
      <div className="training-admin-summary">
        <article>
          <span>มีสิทธิ์ทั้งหมด</span>
          <b>{number(summary.eligible).toLocaleString("th-TH")}</b>
        </article>
        <article>
          <span>ต้องอบรม</span>
          <b>{number(summary.assigned).toLocaleString("th-TH")}</b>
        </article>
        <article>
          <span>ยกเว้นการอบรม</span>
          <b>{number(summary.exempted).toLocaleString("th-TH")}</b>
        </article>
        <article className="warning">
          <span>รอตรวจสอบ</span>
          <b>{number(summary.review_pending).toLocaleString("th-TH")}</b>
        </article>
        <article className="success">
          <span>อนุมัติแล้ว</span>
          <b>{number(summary.approved).toLocaleString("th-TH")}</b>
        </article>
      </div>
      <section className="admin-panel">
        <div className="training-admin-filters">
          <form className="search-box admin-search" onSubmit={submitSearch}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาเลขประจำตัวหรือชื่อ..."
            />
          </form>
          <label>
            <FontAwesomeIcon icon={faFilter} />
            <select
              value={grade}
              onChange={(event) => {
                setGrade(event.target.value);
                setRoom("");
                setPage(1);
              }}
            >
              <option value="">ทุกระดับชั้น</option>
              {grades.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <select
            value={room}
            onChange={(event) => {
              setRoom(event.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกห้อง</option>
            {rooms.map((item) => (
              <option key={item} value={item}>
                ห้อง {item}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกสถานะ</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {selected.length > 0 && (
          <div className="training-bulk-actions">
            <b>เลือก {selected.length} คน</b>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void action(
                  { action: "exempt", studentIds: selected },
                  "ยกเว้นการอบรมแล้ว",
                )
              }
            >
              <FontAwesomeIcon icon={faShieldHalved} /> ยกเว้นการอบรม
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void action(
                  { action: "allowQuiz", studentIds: selected },
                  "เปิดให้ทำแบบทดสอบทันทีแล้ว",
                )
              }
            >
              <FontAwesomeIcon icon={faForward} /> ข้ามวิดีโอ
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void action(
                  { action: "revokeExemption", studentIds: selected },
                  "ยกเลิกการยกเว้นแล้ว",
                )
              }
            >
              <FontAwesomeIcon icon={faXmark} /> ยกเลิกการยกเว้น
            </button>
          </div>
        )}
        <div className="admin-table-wrap">
          {loading ? (
            <div className="loading-row">
              <FontAwesomeIcon icon={faSpinner} spin /> กำลังโหลดข้อมูล...
            </div>
          ) : (
            <table className="admin-table training-admin-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="เลือกทั้งหมด"
                    />
                  </th>
                  <th>นักเรียน</th>
                  <th>ชั้น / ห้อง</th>
                  <th>ความคืบหน้า</th>
                  <th>แบบทดสอบ</th>
                  <th>ผู้ปกครอง</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = text(row.student_id),
                    state = text(row.training_status),
                    watched = number(row.watched_seconds),
                    duration = number(row.video_duration),
                    progress = duration
                      ? Math.min(100, Math.round((watched / duration) * 100))
                      : 0,
                    canAllowQuiz = [
                      "ASSIGNED",
                      "IN_PROGRESS",
                      "QUIZ_FAILED",
                      "VIDEO_COMPLETED",
                    ].includes(state);
                  return (
                    <tr key={id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(id)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(id)
                                ? current.filter((item) => item !== id)
                                : [...current, id],
                            )
                          }
                        />
                      </td>
                      <td>
                        <b>
                          {text(row.prefix)}
                          {text(row.first_name)} {text(row.last_name)}
                        </b>
                        <small>{text(row.student_code)}</small>
                      </td>
                      <td>
                        {text(row.grade_level)}/{text(row.room)}
                        <small>เลขที่ {text(row.class_number) || "—"}</small>
                      </td>
                      <td>
                        <div className="training-mini-progress">
                          <i style={{ width: `${progress}%` }} />
                        </div>
                        <small>
                          {progress}% · รอบ {number(row.cycle) || "—"}
                        </small>
                      </td>
                      <td>
                        {row.quiz_score == null ? (
                          "—"
                        ) : (
                          <b>{number(row.quiz_score)}/10</b>
                        )}
                        <small>{number(row.quiz_attempts)} ครั้ง</small>
                      </td>
                      <td>
                        {text(row.guardian_name) || "—"}
                        <small>{text(row.guardian_relationship) || ""}</small>
                      </td>
                      <td>
                        <span
                          className={`training-status ${state.toLowerCase()}`}
                        >
                          {labels[state] || state}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {state === "EXEMPT" ? (
                            <button
                              className="button small"
                              disabled={busy}
                              onClick={() =>
                                void action(
                                  {
                                    action: "revokeExemption",
                                    studentIds: [id],
                                  },
                                  "ยกเลิกการยกเว้นแล้ว",
                                )
                              }
                            >
                              <FontAwesomeIcon icon={faXmark} /> ยกเลิกยกเว้น
                            </button>
                          ) : state === "REVIEW_PENDING" ? (
                            <button
                              className="button primary small"
                              onClick={() => {
                                setReview(row);
                                setRejecting(false);
                                setNote("");
                              }}
                            >
                              <FontAwesomeIcon icon={faEye} /> ตรวจสอบ
                            </button>
                          ) : (
                            state !== "APPROVED" && (
                              <>
                                {canAllowQuiz && (
                                  <button
                                    className="icon-button"
                                    title="ข้ามวิดีโอและเปิดแบบทดสอบ"
                                    disabled={busy}
                                    onClick={() =>
                                      void action(
                                        {
                                          action: "allowQuiz",
                                          studentIds: [id],
                                        },
                                        "เปิดให้ทำแบบทดสอบทันทีแล้ว",
                                      )
                                    }
                                  >
                                    <FontAwesomeIcon icon={faForward} />
                                  </button>
                                )}
                                {state !== "ASSIGNED" && (
                                  <button
                                    className="icon-button"
                                    title="เปิดให้เริ่มใหม่"
                                    disabled={busy}
                                    onClick={() =>
                                      void action(
                                        {
                                          action: "reset",
                                          studentId: id,
                                          note: "เปิดให้เริ่มการอบรมใหม่",
                                        },
                                        "เปิดให้เริ่มใหม่แล้ว",
                                      )
                                    }
                                  >
                                    <FontAwesomeIcon icon={faRedo} />
                                  </button>
                                )}
                                <button
                                  className="icon-button"
                                  title="ยกเว้นการอบรม"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(
                                      { action: "exempt", studentIds: [id] },
                                      "ยกเว้นการอบรมแล้ว",
                                    )
                                  }
                                >
                                  <FontAwesomeIcon icon={faShieldHalved} />
                                </button>
                              </>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !rows.length && (
            <div className="empty-state small">ไม่พบรายชื่อตามตัวกรอง</div>
          )}
        </div>
        {total > 50 && (
          <nav className="table-pagination" aria-label="เปลี่ยนหน้ารายการอบรมผู้ปกครอง">
            <span>
              แถว {((page - 1) * 50 + 1).toLocaleString("th-TH")}-
              {Math.min(page * 50, total).toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")}
            </span>
            <div>
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="หน้าก่อนหน้า"
                title="หน้าก่อนหน้า"
              >
                <FontAwesomeIcon icon={faChevronLeft}/>
              </button>
              <b>หน้า {page.toLocaleString("th-TH")} / {pages.toLocaleString("th-TH")}</b>
              <button
                type="button"
                disabled={page >= pages || loading}
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
                aria-label="หน้าถัดไป"
                title="หน้าถัดไป"
              >
                <FontAwesomeIcon icon={faChevronRight}/>
              </button>
            </div>
          </nav>
        )}
      </section>
      {review && (
        <div
          className="modal-backdrop training-review-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setReview(null);
          }}
        >
          <section
            className="modal training-review-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span className="eyebrow">ตรวจสอบผู้เข้าอบรม</span>
                <h2>
                  {text(review.prefix)}
                  {text(review.first_name)} {text(review.last_name)}
                </h2>
                <p>
                  {text(review.grade_level)}/{text(review.room)} ·{" "}
                  {text(review.student_code)}
                </p>
              </div>
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>
            <img
              className="training-review-selfie"
              src={`/api/admin/training/selfie/${text(review.student_id)}?v=${encodeURIComponent(text(review.submitted_at))}`}
              alt="ภาพยืนยันตัวตนผู้ปกครอง"
            />
            <div className="training-review-facts">
              <span>
                <small>ผู้เข้าอบรม</small>
                <b>{text(review.guardian_name) || "—"}</b>
              </span>
              <span>
                <small>ความสัมพันธ์</small>
                <b>{text(review.guardian_relationship) || "—"}</b>
              </span>
              <span>
                <small>คะแนน</small>
                <b>{number(review.quiz_score)}/10</b>
              </span>
              <span>
                <small>จำนวนรอบ</small>
                <b>{number(review.cycle)}</b>
              </span>
            </div>
            {rejecting && (
              <label className="field">
                <span>เหตุผลที่ให้ส่งข้อมูลใหม่</span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="ระบุเหตุผลอย่างน้อย 3 ตัวอักษร"
                />
              </label>
            )}
            <div className="modal-actions">
              {rejecting ? (
                <>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setRejecting(false)}
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    className="button danger"
                    disabled={busy || note.trim().length < 3}
                    onClick={() =>
                      void action(
                        {
                          action: "reject",
                          studentId: text(review.student_id),
                          note,
                        },
                        "แจ้งให้ส่งข้อมูลใหม่แล้ว",
                      )
                    }
                  >
                    <FontAwesomeIcon
                      icon={busy ? faSpinner : faXmark}
                      spin={busy}
                    />{" "}
                    ยืนยันไม่อนุมัติ
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() => setRejecting(true)}
                  >
                    <FontAwesomeIcon icon={faXmark} /> ให้ส่งใหม่
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        {
                          action: "approve",
                          studentId: text(review.student_id),
                          note: "",
                        },
                        "อนุมัติผลการอบรมแล้ว",
                      )
                    }
                  >
                    <FontAwesomeIcon
                      icon={busy ? faSpinner : faUserCheck}
                      spin={busy}
                    />{" "}
                    อนุมัติ
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
