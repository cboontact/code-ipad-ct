import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { StudentAwatDocument } from "@/components/admin/student-awat-document";
import { PrintButton } from "@/components/admin/print-button";
import { getPrintableStudent } from "@/lib/db/student-print";
import { documentLanguage } from "@/lib/i18n/document-language";
import "../../print.css";

export default async function PrintStudentPage({params,searchParams}:{params:Promise<{studentId:string}>;searchParams:Promise<{embed?:string;lang?:string}>}) {
  const [{studentId},{embed,lang},cookieStore]=await Promise.all([params,searchParams,cookies()]);
  const language=documentLanguage(lang,cookieStore.get("ipad_language")?.value);
  const data=await getPrintableStudent(studentId);
  if(!data) notFound();
  return <div className={`print-stage${embed==="1"?" print-embed":""}`}><div className="print-toolbar no-print"><div><b>{language==="en"?"Student AWAT-03 Form":"แบบฟอร์ม AWAT-03 นักเรียน"}</b><small>{data.borrowerName}</small></div><PrintButton language={language}/></div><StudentAwatDocument data={data} language={language}/></div>;
}
