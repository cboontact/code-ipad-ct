import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { AwatDocument } from "@/components/admin/awat-document";
import { PrintButton } from "@/components/admin/print-button";
import { getPrintableTeacher } from "@/lib/db/print";
import { documentLanguage } from "@/lib/i18n/document-language";
import "../print.css";
export default async function PrintTeacherPage({params,searchParams}:{params:Promise<{teacherId:string}>;searchParams:Promise<{embed?:string;lang?:string}>}){const[{teacherId},{embed,lang},cookieStore]=await Promise.all([params,searchParams,cookies()]),language=documentLanguage(lang,cookieStore.get("ipad_language")?.value),data=await getPrintableTeacher(teacherId);if(!data)notFound();return <div className={`print-stage${embed==="1"?" print-embed":""}`}><div className="print-toolbar no-print"><div><b>{language==="en"?"AWAT-03 Form":"แบบฟอร์ม AWAT03"}</b><small>{data.borrowerName}</small></div><PrintButton language={language}/></div><AwatDocument data={data} language={language}/></div>}
