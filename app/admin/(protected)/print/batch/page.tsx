import { cookies } from "next/headers";
import { AwatDocument } from "@/components/admin/awat-document";
import { PrintButton } from "@/components/admin/print-button";
import { getAcceptedTeacherIds,getPrintableTeacher } from "@/lib/db/print";
import { documentLanguage } from "@/lib/i18n/document-language";
import "../print.css";
export default async function BatchPrintPage({searchParams}:{searchParams:Promise<{area?:string;embed?:string;lang?:string}>}){const[{area,embed,lang},cookieStore]=await Promise.all([searchParams,cookies()]),language=documentLanguage(lang,cookieStore.get("ipad_language")?.value),ids=await getAcceptedTeacherIds(area),items=(await Promise.all(ids.map(getPrintableTeacher))).filter(Boolean);return <div className={`print-stage${embed==="1"?" print-embed":""}`}><div className="print-toolbar no-print"><div><b>{language==="en"?"Batch Print AWAT-03":"พิมพ์ AWAT03 แบบชุด"}</b><small>{language==="en"?`${items.length} iPad recipients`:`ผู้รับ iPad จำนวน ${items.length} คน`}</small></div><PrintButton language={language}/></div>{items.map(item=><AwatDocument key={item!.id} data={item!} language={language}/>)}</div>}
