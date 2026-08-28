import { notFound } from "next/navigation";
import { AwatDocument } from "@/components/admin/awat-document";
import { PrintButton } from "@/components/admin/print-button";
import { getPrintableTeacher } from "@/lib/db/print";
import "../print.css";
export default async function PrintTeacherPage({params,searchParams}:{params:Promise<{teacherId:string}>;searchParams:Promise<{embed?:string}>}){const[{teacherId},{embed}]=await Promise.all([params,searchParams]),data=await getPrintableTeacher(teacherId);if(!data)notFound();return <div className={`print-stage${embed==="1"?" print-embed":""}`}><div className="print-toolbar no-print"><div><b>แบบฟอร์ม AWAT03</b><small>{data.borrowerName}</small></div><PrintButton/></div><AwatDocument data={data}/></div>}
