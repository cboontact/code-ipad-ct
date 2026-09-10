import { PrintButton } from "@/components/admin/print-button";
import { StudentAwatDocument } from "@/components/admin/student-awat-document";
import { getAcceptedStudentIds, getPrintableStudent } from "@/lib/db/student-print";
import { documentLanguage } from "@/lib/i18n/document-language";
import "../print.css";

type StudentBatchSearchParams = {
  embed?: string;
  search?: string;
  grade?: string;
  room?: string;
  status?: string;
  approval?: string;
  lang?: string;
};

export default async function StudentBatchPrintPage({searchParams}:{searchParams:Promise<StudentBatchSearchParams>}) {
  const [{embed,search,grade,room,status,approval,lang},cookieStore]=await Promise.all([searchParams,cookies()]);
  const language=documentLanguage(lang,cookieStore.get("ipad_language")?.value);
  const ids = await getAcceptedStudentIds({search,grade,room,status,approval});
  const items = (await Promise.all(ids.map(getPrintableStudent))).filter(Boolean);
  return (
    <div className={`print-stage${embed==="1"?" print-embed":""}`}>
      <div className="print-toolbar no-print">
        <div>
          <b>{language==="en"?"Batch Print Student AWAT-03":"พิมพ์ AWAT-03 นักเรียนแบบชุด"}</b>
          <small>{language==="en"?`${items.length} student iPad recipients`:`นักเรียนผู้รับ iPad จำนวน ${items.length} คน`}</small>
        </div>
        <PrintButton language={language} />
      </div>
      {items.map(item => <StudentAwatDocument key={item!.id} data={item!} language={language} />)}
    </div>
  );
}
import { cookies } from "next/headers";
