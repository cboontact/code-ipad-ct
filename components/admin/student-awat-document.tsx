import Image from "next/image";
import type { PrintableStudent } from "@/lib/db/student-print";
import { studentGradeNumber } from "@/lib/data/student-options";
import type { DocumentLanguage } from "@/lib/i18n/document-language";

const Line = ({children,className=""}:{children?:React.ReactNode;className?:string}) => <span className={`awat-line ${className}`}>{children}</span>;

export function StudentAwatDocument({data,language="th"}:{data:PrintableStudent;language?:DocumentLanguage}) {
  const x=data.settings;
  const digits=(data.citizenId||"").padEnd(13," ").slice(0,13).split("");
  const en=language==="en";
  return <article className={`awat-page student-awat-page${en?" awat-page-en":""}`} lang={language}>
    <div className="awat-top"><Image className="awat-obec" src="/awat-assets/moe.jpg" width={1414} height={1414} alt={en?"Office of the Basic Education Commission emblem":"ตราสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"} unoptimized priority/><div className="awat-code">AWAT-03</div></div>
    <header><h1>{en?"Teaching and Learning Equipment Loan Form":"แบบฟอร์มการยืมอุปกรณ์การเรียนการสอน"}</h1><h2>{en?"Office of the Basic Education Commission":"สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"}</h2></header>
    <div className="awat-number">{en?"Document No.":"เลขที่"} <Line className="short">{data.documentNumber}</Line> / {data.documentYear}</div>
    <section className="awat-info">
      <div>{en?"School":"โรงเรียน"} <Line className="school">{x.school_name}</Line> {en?"Subdistrict":"ตำบล"} <Line>{x.subdistrict}</Line> {en?"District":"อำเภอ"} <Line>{x.district}</Line></div>
      <div>{en?"Province":"จังหวัด"} <Line>{x.province}</Line> {en?"Affiliation":"สังกัด"} <Line className="organization">{x.organization}</Line></div>
      <div>{en?"Brand":"ยี่ห้อ"} <Line className="brand">{x.device_brand}</Line> {en?"Model":"รุ่น"} <Line className="model">{x.device_model}</Line> Serial Number S/N <Line className="serial">{data.serialNumber}</Line></div>
    </section>
    <ol className="awat-list">
      <li><span className="awat-item-number">1.</span><div className="awat-item-body"><div>{en?"Borrower's name":"ชื่อผู้ยืม"} <Line className="borrower">{data.borrowerName}</Line></div><div className="citizen-row"><span>{en?"National ID / Passport No.":"เลขประจำตัวประชาชน / Passport"}</span><span className="digit-boxes">{digits.map((digit,index)=><i key={index}>{digit.trim()}</i>)}</span></div></div></li>
      <li><span className="awat-item-number">2.</span><div className="awat-item-body">{en?"Grade":"ชั้นมัธยมศึกษาปีที่"} <Line className="student-grade">{studentGradeNumber(data.gradeLevel)}</Line> {en?"Room":"ห้อง"} <Line className="student-room">{data.room}</Line> {en?"Student ID":"รหัสนักเรียน"} <Line className="student-code">{data.studentCode}</Line></div></li>
      <li><span className="awat-item-number">3.</span><div className="awat-item-body"><div>{en?"House No.":"อยู่บ้านเลขที่"} <Line className="house">{data.houseNo}</Line> {en?"Village No.":"หมู่"} <Line className="small">{data.moo}</Line> {en?"Alley":"ซอย"} <Line>{data.soi}</Line> {en?"Road":"ถนน"} <Line>{data.road}</Line></div><div>{en?"Subdistrict":"ตำบล"} <Line>{data.subdistrict}</Line> {en?"District":"อำเภอ"} <Line>{data.district}</Line> {en?"Province":"จังหวัด"} <Line>{data.province}</Line> {en?"Postal Code":"รหัสไปรษณีย์"} <Line className="postal">{data.postalCode}</Line></div><div>{en?"Student telephone":"โทรศัพท์นักเรียน"} <Line className="student-phone">{data.phone}</Line> {en?"Parent/Guardian telephone":"โทรศัพท์ผู้ปกครอง"} <Line className="guardian-phone">{data.guardianPhone}</Line></div></div></li>
      <li><span className="awat-item-number">4.</span><div className="awat-item-body">{en?"The teaching and learning equipment, including accessories, is borrowed from":"ได้ยืมอุปกรณ์การเรียนการสอนพร้อมอุปกรณ์เสริม ตั้งแต่วันที่"} <Line className="date"/> {en?"Month":"เดือน"} <Line className="month"/> {en?"Year":"พ.ศ."} <Line className="year"/></div></li>
      <li><span className="awat-item-number">5.</span><div className="awat-item-body">{en?<>If the equipment is damaged or lost through misconduct, the borrower and parent/guardian agree to accept responsibility<br/>and reimburse the lender for the teaching and learning equipment as prescribed.</>:<>หากเกิดความเสียหายหรือสูญหายโดยไม่สุจริต ข้าพเจ้าและผู้ปกครองยินยอมรับผิดชอบ ชดใช้ค่าอุปกรณ์<br/>การเรียนการสอนให้กับผู้ให้ยืม ตามที่กำหนด</>}</div></li>
      <li><span className="awat-item-number">6.</span><div className="awat-item-body">{en?<>The equipment must not be modified, repaired, altered, or replaced without the lender&apos;s permission.<br/>If discovered later, the borrower shall be liable for the resulting damage.</>:<>การนำไปดัดแปลง ซ่อมแซม แก้ไขหรือจัดหามาทดแทน โดยที่ไม่ได้รับการยินยอมจากผู้ให้ยืม หากตรวจพบ<br/>ภายหลัง ผู้ยืมจะต้องรับผิดชอบค่าเสียหาย</>}</div></li>
    </ol>
    <section className="signature-stack student-signatures"><Signature role={en?"Borrower":"ผู้ยืม"} name={data.borrowerName} language={language}/><Signature role={en?"Parent/Guardian":"ผู้ปกครอง"} name={`${data.guardianPrefix}${data.guardianName}`} language={language}/><Signature role={en?"Homeroom Teacher":"ครูที่ปรึกษา"} name={data.advisorName} language={language}/><Signature role={en?"Approver":"ผู้อนุมัติ"} name={x.student_approver_name || x.approver_name} language={language}/></section>
  </article>;
}

function Signature({role,name="",language="th"}:{role:string;name?:string;language?:DocumentLanguage}) { return <div className="signature"><div>{language==="en"?"Signature":"ลงชื่อ"} <Line className="signature-line"/> {role}</div><div>( <span>{name}</span> )</div><div><Line className="signature-date"/> / <Line className="signature-date"/> / <Line className="signature-year"/></div></div>; }
