import { cookies } from "next/headers";
import Image from "next/image";
import { PrintButton } from "@/components/admin/print-button";
import { getStudentRecipientList } from "@/lib/db/student-print";
import { documentLanguage } from "@/lib/i18n/document-language";
import "../print.css";

type SearchParams = {
  embed?: string;
  search?: string;
  grade?: string;
  room?: string;
  approval?: string;
  lang?: string;
};

export default async function StudentRecipientListPage({searchParams}:{searchParams:Promise<SearchParams>}) {
  const [{embed,search,grade,room,approval,lang},cookieStore] = await Promise.all([searchParams,cookies()]);
  const language = documentLanguage(lang,cookieStore.get("ipad_language")?.value);
  const {rows,settings} = await getStudentRecipientList({search,grade,room,approval});
  const en = language === "en";
  const filterText = [grade,room ? `${en?"Room":"ห้อง"} ${room}` : ""].filter(Boolean).join(" / ");
  return <div className={`print-stage recipient-list-stage${embed==="1"?" print-embed":""}`}>
    <div className="print-toolbar no-print"><div><b>{en?"Student iPad Recipient List":"รายชื่อนักเรียนผู้ยืนยันรับ iPad"}</b><small>{rows.length.toLocaleString(en?"en-US":"th-TH")} {en?"students":"คน"}</small></div><PrintButton language={language}/></div>
    <article className="recipient-list-page">
      <header>
        <Image className="recipient-list-logo" src="/api/public/logo" width={68} height={68} alt={en?"School logo":"ตราสัญลักษณ์โรงเรียน"}/>
        <h1>{en?"Student iPad Recipient List":"รายชื่อนักเรียนผู้ยืนยันรับ iPad"}</h1>
        <h2>{settings.school_name}</h2>
        <p>{filterText || (en?"All grade levels and rooms":"ทุกระดับชั้นและทุกห้อง")} · {en?"Total":"รวม"} {rows.length.toLocaleString(en?"en-US":"th-TH")} {en?"students":"คน"}</p>
      </header>
      <table><thead><tr><th>{en?"No.":"ลำดับ"}</th><th>{en?"Student ID":"เลขประจำตัว"}</th><th>{en?"Name":"ชื่อ-นามสกุล"}</th><th>{en?"Class / Room / No.":"ชั้น / ห้อง / เลขที่"}</th><th>{en?"Document":"เอกสาร"}</th><th>{en?"Approval":"อนุมัติ"}</th><th>{en?"Signature":"ลงชื่อ"}</th></tr></thead>
      <tbody>{rows.map((row,index)=><tr key={row.studentCode}><td>{index+1}</td><td>{row.studentCode}</td><td>{row.fullName}</td><td>{row.gradeLevel}/{row.room}{row.classNumber?` / ${row.classNumber}`:""}</td><td>{row.documentReceived?(en?"Received":"รับแล้ว"):"—"}</td><td>{row.approvalStatus==="APPROVED"?(en?"Approved":"อนุมัติแล้ว"):(en?"Pending":"รออนุมัติ")}</td><td></td></tr>)}</tbody></table>
      {!rows.length&&<div className="recipient-list-empty">{en?"No students match the selected filters.":"ไม่พบรายชื่อนักเรียนตามตัวกรองที่เลือก"}</div>}
      <footer>{en?"Printed":"พิมพ์เมื่อ"} {new Date().toLocaleString(en?"en-GB":"th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"})}</footer>
    </article>
  </div>;
}
