import { AwatDocument } from "@/components/admin/awat-document";
import { PrintButton } from "@/components/admin/print-button";
import { getAcceptedTeacherIds,getPrintableTeacher } from "@/lib/db/print";
import "../print.css";
export default async function BatchPrintPage({searchParams}:{searchParams:Promise<{area?:string;embed?:string}>}){const{area,embed}=await searchParams,ids=await getAcceptedTeacherIds(area),items=(await Promise.all(ids.map(getPrintableTeacher))).filter(Boolean);return <div className={`print-stage${embed==="1"?" print-embed":""}`}><div className="print-toolbar no-print"><div><b>พิมพ์ AWAT03 แบบชุด</b><small>ผู้รับ iPad จำนวน {items.length} คน</small></div><PrintButton/></div>{items.map(item=><AwatDocument key={item!.id} data={item!}/>)}</div>}
