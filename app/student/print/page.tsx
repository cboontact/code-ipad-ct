import Link from "next/link";
import { cookies } from "next/headers";
import { StudentAwatDocument } from "@/components/admin/student-awat-document";
import { PrintButton } from "@/components/admin/print-button";
import { getPrintableStudent } from "@/lib/db/student-print";
import { documentLanguage } from "@/lib/i18n/document-language";
import {
  STUDENT_PRINT_COOKIE,
  studentIdFromPrintToken,
} from "@/lib/security/student-print-session";
import "../../admin/(protected)/print/print.css";

export const dynamic = "force-dynamic";

export default async function StudentSelfPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ lang }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const language = documentLanguage(lang, cookieStore.get("ipad_language")?.value);
  const studentId = await studentIdFromPrintToken(
    cookieStore.get(STUDENT_PRINT_COOKIE)?.value,
  );
  const data = studentId ? await getPrintableStudent(studentId) : null;

  if (!data) {
    return (
      <main className="shell public-main student-survey-page">
        <section className="student-approval-card rejected">
          <span className="eyebrow">AWAT-03</span>
          <h1>{language === "en" ? "Print access expired" : "สิทธิ์พิมพ์หมดอายุ"}</h1>
          <p className="student-approval-description">
            {language === "en"
              ? "Please verify your student ID again to open the document."
              : "กรุณากลับไปกรอกเลขประจำตัวนักเรียนอีกครั้งเพื่อเปิดเอกสาร"}
          </p>
          <Link className="button primary" href="/student">
            {language === "en" ? "Verify student ID" : "กลับไปตรวจสอบข้อมูล"}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <div className="print-stage public-student-print">
      <div className="print-toolbar no-print">
        <div>
          <b>{language === "en" ? "Student AWAT-03 Form" : "แบบฟอร์ม AWAT-03 นักเรียน"}</b>
          <small>{data.borrowerName}</small>
        </div>
        <PrintButton language={language} />
      </div>
      <StudentAwatDocument data={data} language={language} />
    </div>
  );
}
