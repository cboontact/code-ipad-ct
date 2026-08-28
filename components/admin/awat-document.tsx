import Image from "next/image";
import type { PrintableTeacher } from "@/lib/db/print";

const Line = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <span className={`awat-line ${className}`}>{children}</span>
);

export function AwatDocument({ data }: { data: PrintableTeacher }) {
  const x = data.settings;
  const digits = (data.citizenId || "").padEnd(13, " ").slice(0, 13).split("");

  return (
    <article className="awat-page">
      <div className="awat-top">
        <Image
          className="awat-obec"
          src="/awat-assets/moe.jpg"
          width={1414}
          height={1414}
          alt="ตราสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"
          unoptimized
          priority
        />
        <div className="awat-code">AWAT-03</div>
      </div>

      <header>
        <h1>แบบฟอร์มการยืมอุปกรณ์การเรียนการสอน</h1>
        <h2>สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน</h2>
      </header>

      <div className="awat-number">เลขที่ <Line className="short">{data.documentNumber}</Line> / {data.documentYear}</div>

      <section className="awat-info">
        <div>โรงเรียน <Line className="school">{x.school_name}</Line> ตำบล <Line>{x.subdistrict}</Line> อำเภอ <Line>{x.district}</Line></div>
        <div>จังหวัด <Line>{x.province}</Line> สังกัด <Line className="organization">{x.organization}</Line></div>
        <div>ยี่ห้อ <Line className="brand">{x.device_brand}</Line> รุ่น <Line className="model">{x.device_model}</Line> Serial Number S/N <Line className="serial">{data.serialNumber}</Line></div>
      </section>

      <ol className="awat-list">
        <li>
          <span className="awat-item-number">1.</span>
          <div className="awat-item-body">
            <div>ชื่อผู้ยืม (ครู/บุคลากร) <Line className="borrower">{data.borrowerName}</Line></div>
            <div className="citizen-row">
              <span>หมายเลขประจำตัวประชาชน</span>
              <span className="digit-boxes">{digits.map((digit, i) => <i key={i}>{digit.trim()}</i>)}</span>
            </div>
          </div>
        </li>
        <li>
          <span className="awat-item-number">2.</span>
          <div className="awat-item-body">ตำแหน่ง <Line className="position">{data.position}</Line> รหัสครู/บุคลากร <Line className="teacher-code">{data.teacherCode}</Line></div>
        </li>
        <li>
          <span className="awat-item-number">3.</span>
          <div className="awat-item-body">
            <div>อยู่บ้านเลขที่ <Line className="house">{data.houseNo}</Line> หมู่ <Line className="small">{data.moo}</Line> ซอย <Line>{data.soi}</Line> ถนน <Line>{data.road}</Line></div>
            <div>ตำบล <Line>{data.subdistrict}</Line> อำเภอ <Line>{data.district}</Line> จังหวัด <Line>{data.province}</Line> รหัสไปรษณีย์ <Line className="postal">{data.postalCode}</Line></div>
            <div>โทรศัพท์ <Line className="phone">{data.phone}</Line></div>
          </div>
        </li>
        <li>
          <span className="awat-item-number">4.</span>
          <div className="awat-item-body">ได้ยืมอุปกรณ์การเรียนการสอนพร้อมอุปกรณ์เสริม ตั้งแต่วันที่ <Line className="date" /> เดือน <Line className="month" /> พ.ศ. <Line className="year" /></div>
        </li>
        <li>
          <span className="awat-item-number">5.</span>
          <div className="awat-item-body">หากเกิดความเสียหายหรือสูญหายโดยไม่สุจริต ข้าพเจ้ายินยอมรับผิดชอบ ชดใช้ค่าอุปกรณ์การเรียนการสอนให้กับ<br />ผู้ให้ยืม ตามที่กำหนด</div>
        </li>
        <li>
          <span className="awat-item-number">6.</span>
          <div className="awat-item-body">การนำไปดัดแปลง ซ่อมแซม แก้ไขหรือจัดหามาทดแทน โดยที่ไม่ได้รับการยินยอมจากผู้ให้ยืม หากตรวจพบภายหลัง<br />ผู้ยืมจะต้องรับผิดชอบค่าเสียหาย</div>
        </li>
      </ol>

      <section className="signature-stack">
        <Signature role="ผู้ยืม" name={data.borrowerName} />
        <Signature role="พยาน" />
        <Signature
          role="ผู้อนุมัติ"
          name={x.teacher_approver_name || x.approver_name}
        />
      </section>

    </article>
  );
}

function Signature({ role, name = "" }: { role: string; name?: string }) {
  return (
    <div className="signature">
      <div>ลงชื่อ <Line className="signature-line" /> {role}</div>
      <div>( <span>{name}</span> )</div>
      <div><Line className="signature-date" /> / <Line className="signature-date" /> / <Line className="signature-year" /></div>
    </div>
  );
}
