"use client";
import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faCircleCheck,
  faDownload,
  faFileArrowUp,
  faFileCsv,
  faMagnifyingGlass,
  faSpinner,
  faTriangleExclamation,
  faUpload,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";
import { readTabularFile, writeXlsxRows } from "@/lib/spreadsheet-client";
import { isNdlpEmail, isSchoolEmail } from "@/lib/validation/email-domains";
type ImportRow = {
  prefix: string;
  first_name: string;
  last_name: string;
  learning_area: string;
  position: string;
  academic_rank: string;
  email: string;
  ndlp_email: string;
  phone: string;
  _error?: string;
};
const headers = [
  "prefix",
  "first_name",
  "last_name",
  "learning_area",
  "position",
  "academic_rank",
  "email",
  "ndlp_email",
  "phone",
];
const headerAliases: Record<(typeof headers)[number], string[]> = {
  prefix: ["prefix", "คำนำหน้า"],
  first_name: ["first_name", "ชื่อ"],
  last_name: ["last_name", "นามสกุล"],
  learning_area: ["learning_area", "กลุ่มสาระ"],
  position: ["position", "ตำแหน่ง"],
  academic_rank: ["academic_rank", "วิทยฐานะ"],
  email: ["email", "อีเมลโรงเรียน"],
  ndlp_email: ["ndlp_email", "อีเมล NDLP"],
  phone: ["phone", "เบอร์โทรศัพท์", "โทรศัพท์"],
};
type ImportWizardProps = {
  embedded?: boolean;
  onClose?: () => void;
  onImported?: () => void;
};

export function ImportWizard({
  embedded = false,
  onClose,
  onImported,
}: ImportWizardProps = {}) {
  const [step, setStep] = useState(1),
    [fileName, setFileName] = useState(""),
    [rows, setRows] = useState<ImportRow[]>([]),
    [busy, setBusy] = useState(false),
    [missing, setMissing] = useState<string[]>([]),
    [result, setResult] = useState<{
      imported: number;
      updated: number;
      errors: Array<{ row: number; message: string }>;
    } | null>(null);
  function normalize(value: unknown) {
    return value == null ? "" : String(value).trim();
  }
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const raw = await readTabularFile(file);
      const parsed = raw.map((record) => {
        const source = new Map(
          Object.entries(record).map(([key, value]) => [
            key.trim().toLowerCase(),
            value,
          ]),
        );
        const row = Object.fromEntries(
          headers.map((key) => [
            key,
            normalize(
              headerAliases[key]
                .map((alias) => source.get(alias.toLowerCase()))
                .find((value) => value !== undefined),
            ),
          ]),
        ) as unknown as ImportRow;
        const errors = [];
        if (!row.prefix) errors.push("ไม่มีคำนำหน้า");
        if (!row.first_name) errors.push("ไม่มีชื่อ");
        if (!row.last_name) errors.push("ไม่มีนามสกุล");
        if (!row.learning_area) errors.push("ไม่มีกลุ่มสาระ");
        if (row.email && !isSchoolEmail(row.email))
          errors.push("อีเมลโรงเรียนต้องเป็น @chomthong.ac.th");
        if (row.ndlp_email && !isNdlpEmail(row.ndlp_email))
          errors.push("อีเมล NDLP ต้องเป็น @ndlp.go.th");
        if (row.phone && !/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/.test(row.phone))
          errors.push("เบอร์โทรศัพท์ไม่ถูกต้อง");
        row._error = errors.join(", ");
        return row;
      });
      if (!parsed.length) throw new Error("ไม่พบข้อมูลในไฟล์");
      setRows(parsed);
      setFileName(file.name);
      setStep(2);
      toast.success(`อ่านข้อมูล ${parsed.length} รายการแล้ว`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function downloadTemplate() {
    const sample = [
        {
          คำนำหน้า: "นาย",
          ชื่อ: "สมชาย",
          นามสกุล: "ใจดี",
          กลุ่มสาระ: "ภาษาไทย",
          ตำแหน่ง: "",
          วิทยฐานะ: "",
          อีเมลโรงเรียน: "",
          "อีเมล NDLP": "",
          เบอร์โทรศัพท์: "",
        },
      ];
    await writeXlsxRows(sample, "teacher-import-template.xlsx");
  }
  async function commit(createMissingAreas = false) {
    if (rows.some((row) => row._error)) {
      toast.error("กรุณาแก้ไขข้อมูลที่ผิดพลาดก่อนนำเข้า");
      return;
    }
    setBusy(true);
    try {
      const clean = rows.map((row) =>
          Object.fromEntries(headers.map((key) => [key, row[key as keyof ImportRow]])),
        ),
        r = await fetch("/api/admin/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: clean, createMissingAreas }),
        }),
        body = await readJson<{
          error?: string;
          missingAreas?: string[];
          imported: number;
          updated: number;
          errors: Array<{ row: number; message: string }>;
        }>(r);
      if (r.status === 409 && body.missingAreas) {
        setMissing(body.missingAreas);
        return;
      }
      if (!r.ok) throw new Error(body.error);
      setResult(body);
      setStep(4);
      setMissing([]);
      toast.success("นำเข้ารายชื่อเรียบร้อยแล้ว");
      onImported?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-topline">
        <div>
          <span className="eyebrow">Import Wizard</span>
          <h1 className="admin-page-title">
            <FontAwesomeIcon icon={faFileArrowUp} />
            นำเข้ารายชื่อครู
          </h1>
        </div>
        <div className="toolbar-group">
          {!embedded && (
            <Link href="/admin/teachers" className="button secondary">
              <FontAwesomeIcon icon={faArrowLeft} /> กลับรายชื่อครู
            </Link>
          )}
          <button
            className="button secondary import-template-download"
            onClick={downloadTemplate}
            aria-label="ดาวน์โหลดไฟล์ตัวอย่างสำหรับนำเข้ารายชื่อครู"
            title="ดาวน์โหลด Template"
          >
            <FontAwesomeIcon icon={faDownload} />
            <span>Template</span>
          </button>
          {embedded && (
            <button
              className="icon-button import-modal-close"
              onClick={onClose}
              aria-label="ปิดหน้าต่างนำเข้ารายชื่อ"
              title="ปิด"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>
      </div>
      <div className="admin-panel">
        <div className="import-steps">
          {[
            { label: "เลือกไฟล์", icon: faFileArrowUp },
            { label: "ตรวจสอบข้อมูล", icon: faMagnifyingGlass },
            { label: "ยืนยัน", icon: faCheck },
            { label: "เสร็จสิ้น", icon: faCircleCheck },
          ].map(({ label, icon }, i) => (
              <div
                className={`import-step ${step === i + 1 ? "active" : ""}`}
                key={label}
              >
                <FontAwesomeIcon icon={icon} aria-hidden="true" />
                <span>{i + 1}. {label}</span>
              </div>
            ))}
        </div>
        {step === 1 && (
          <label className="drop-zone">
            <FontAwesomeIcon
              icon={busy ? faSpinner : faFileArrowUp}
              spin={busy}
            />
            <h2>เลือกไฟล์รายชื่อครู</h2>
            <p>
              รองรับ CSV และ XLSX พร้อมหัวตารางภาษาไทยหรืออังกฤษ — กรอกเพียงคำนำหน้า ชื่อ นามสกุล และกลุ่มสาระ
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={selectFile}
              hidden
            />
            <span className="button primary">
              <FontAwesomeIcon icon={faUpload} /> เลือกไฟล์
            </span>
          </label>
        )}
        {step === 2 && (
          <>
            <div className="toolbar">
              <div>
                <b>{fileName}</b>
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  พบ {rows.length} รายการ · ผิดพลาด{" "}
                  {rows.filter((r) => r._error).length} รายการ
                </p>
              </div>
              <div className="toolbar-group">
                <button
                  className="button secondary"
                  onClick={() => {
                    setStep(1);
                    setRows([]);
                  }}
                >
                  <FontAwesomeIcon icon={faArrowLeft} /> เลือกใหม่
                </button>
                <button
                  className="button primary"
                  disabled={rows.some((r) => r._error)}
                  onClick={() => setStep(3)}
                >
                  ถัดไป <FontAwesomeIcon icon={faArrowRight} />
                </button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>แถว</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>กลุ่มสาระ</th>
                    <th>ตำแหน่ง</th>
                    <th>ตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((row, i) => (
                    <tr key={i}>
                      <td>{i + 2}</td>
                      <td>
                        {row.prefix}
                        {row.first_name} {row.last_name}
                      </td>
                      <td>{row.learning_area}</td>
                      <td>
                        {row.position} {row.academic_rank}
                      </td>
                      <td>
                        {row._error ? (
                          <span className="badge decline">
                            <FontAwesomeIcon icon={faTriangleExclamation} />{" "}
                            {row._error}
                          </span>
                        ) : (
                          <span className="badge accept">
                            <FontAwesomeIcon icon={faCheck} /> พร้อมนำเข้า
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {step === 3 && (
          <div
            className="success-card"
            style={{ boxShadow: "none", padding: 30 }}
          >
            <FontAwesomeIcon icon={faFileCsv} />
            <h2>ยืนยันการนำเข้ารายชื่อ</h2>
            <p>
              ระบบจะสร้างรหัสบุคลากรให้อัตโนมัติ และอัปเดตข้อมูลเดิมเมื่อชื่อกับกลุ่มสาระตรงกัน
              จำนวนรวม {rows.length} รายการ
            </p>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setStep(2)}>
                <FontAwesomeIcon icon={faArrowLeft} /> กลับไปตรวจสอบ
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => commit()}
              >
                {busy ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin /> กำลังนำเข้า...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUpload} /> ยืนยันนำเข้า
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        {step === 4 && result && (
          <div
            className="success-card"
            style={{ boxShadow: "none", padding: 30 }}
          >
            <div className="success-icon">
              <FontAwesomeIcon icon={faCheck} />
            </div>
            <h2>นำเข้าข้อมูลสำเร็จ</h2>
            <p>
              เพิ่มใหม่ {result.imported} ราย · อัปเดต {result.updated} ราย ·
              ผิดพลาด {result.errors.length} ราย
            </p>
            {embedded ? (
              <button className="button primary" onClick={onClose}>
                ปิดและดูรายชื่อครู
              </button>
            ) : (
              <a href="/admin/teachers" className="button primary">
                ไปหน้ารายชื่อครู
              </a>
            )}
          </div>
        )}
      </div>
      {missing.length > 0 && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2>พบกลุ่มสาระใหม่</h2>
            <p>
              ระบบยังไม่มีกลุ่มสาระ: <b>{missing.join(", ")}</b>
            </p>
            <p>ต้องการสร้างกลุ่มสาระเหล่านี้และนำเข้าต่อหรือไม่</p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setMissing([])}
              >
                กลับไปแก้ไข
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => commit(true)}
              >
                {busy ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  <FontAwesomeIcon icon={faCheck} />
                )}{" "}
                สร้างและนำเข้า
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
