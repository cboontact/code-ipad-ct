/* eslint-disable @next/next/no-img-element */
import { cookies } from "next/headers";
import { PrintButton } from "@/components/admin/print-button";
import { getStudentRecipientList } from "@/lib/db/student-print";
import { documentLanguage } from "@/lib/i18n/document-language";
import "../print.css";

type SearchParams = {
  embed?: string;
  search?: string;
  grade?: string;
  room?: string;
  status?: string;
  approval?: string;
  lang?: string;
};

export default async function StudentMeetingAttendancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ embed, search, grade, room, status, approval, lang }, cookieStore] =
    await Promise.all([searchParams, cookies()]);
  const language = documentLanguage(
    lang,
    cookieStore.get("ipad_language")?.value,
  );
  const { rows, settings, advisorNames } = await getStudentRecipientList({
    search,
    grade,
    room,
    status,
    approval,
  });
  const en = language === "en";
  const configuredSchoolName = settings.school_name.trim();
  const schoolName = configuredSchoolName.startsWith("โรงเรียน")
    ? configuredSchoolName
    : `โรงเรียน${configuredSchoolName}`;
  const filterText = grade && room
    ? `${grade}/${room}`
    : [grade, room ? `${en ? "Room" : "ห้อง"} ${room}` : ""]
        .filter(Boolean)
        .join(" / ");

  return (
    <div className={`print-stage meeting-attendance-stage${embed === "1" ? " print-embed" : ""}`}>
      <div className="print-toolbar no-print">
        <div>
          <b>{en ? "Meeting Attendance Sheet" : "บัญชีลงชื่อเข้าร่วมประชุม"}</b>
          <small>{rows.length.toLocaleString(en ? "en-US" : "th-TH")} {en ? "students" : "คน"}</small>
        </div>
        <PrintButton language={language} />
      </div>
      <article className="meeting-attendance-page">
        <header>
          <img className="meeting-attendance-logo" src="/api/public/logo" width="68" height="68" alt={en ? "School logo" : "ตราสัญลักษณ์โรงเรียน"} />
          <h2>{schoolName}</h2>
          <h1>{en ? "Meeting Attendance Sheet" : "บัญชีลงชื่อเข้าร่วมประชุม"}</h1>
          <p>{en ? "Briefing on receiving and using iPads under the Anywhere Anytime project" : "การประชุมชี้แจงแนวทางการรับและใช้งาน iPad ตามโครงการ Anywhere Anytime"}</p>
          <p>{filterText || (en ? "All grade levels and rooms" : "ทุกระดับชั้นและทุกห้อง")} · {en ? "Total" : "รวม"} {rows.length.toLocaleString(en ? "en-US" : "th-TH")} {en ? "students" : "คน"}</p>
          {grade && room && <p className="meeting-attendance-advisors"><b>{en ? "Class advisor" : "ครูที่ปรึกษา"}</b> {advisorNames.length ? advisorNames.join(" / ") : en ? "Not assigned" : "ยังไม่ได้กำหนด"}</p>}
          <div className="meeting-attendance-details">
            <span><b>{en ? "Date" : "วันที่"}</b> {en ? "17 October 2026" : "17 ตุลาคม 2569"}</span>
            <span><b>{en ? "Time" : "เวลา"}</b> {en ? "9:00 a.m." : "9.00 น."}</span>
            <span><b>{en ? "Venue" : "สถานที่"}</b> {en ? "Inthanon Auditorium" : "หอประชุมอินทนนท์"}</span>
          </div>
        </header>
        <table>
          <thead><tr><th>{en ? "No." : "ลำดับ"}</th><th>{en ? "Student ID" : "เลขประจำตัว"}</th><th>{en ? "Name" : "ชื่อ-นามสกุล"}</th><th>{en ? "Class / Room" : "ชั้น / ห้อง"}</th><th>{en ? "Class No." : "เลขที่"}</th><th>{en ? "Signature" : "ลายมือชื่อ"}</th><th>{en ? "Note" : "หมายเหตุ"}</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.studentCode}><td>{index + 1}</td><td>{row.studentCode}</td><td>{row.fullName}</td><td>{row.gradeLevel}/{row.room}</td><td>{row.classNumber || "—"}</td><td></td><td></td></tr>)}</tbody>
        </table>
        {!rows.length && <div className="recipient-list-empty">{en ? "No students match the selected filters." : "ไม่พบรายชื่อนักเรียนตามตัวกรองที่เลือก"}</div>}
      </article>
    </div>
  );
}
