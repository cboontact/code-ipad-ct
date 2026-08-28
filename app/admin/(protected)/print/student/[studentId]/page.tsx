import { notFound } from "next/navigation";
import { StudentAwatDocument } from "@/components/admin/student-awat-document";
import { PrintButton } from "@/components/admin/print-button";
import { getPrintableStudent } from "@/lib/db/student-print";
import "../../print.css";

export default async function PrintStudentPage({params,searchParams}:{params:Promise<{studentId:string}>;searchParams:Promise<{embed?:string}>}) {
  const [{studentId},{embed}]=await Promise.all([params,searchParams]);
  const data=await getPrintableStudent(studentId);
  if(!data) notFound();
  return <div className={`print-stage${embed==="1"?" print-embed":""}`}><div className="print-toolbar no-print"><div><b>แบบฟอร์ม AWAT-03 นักเรียน</b><small>{data.borrowerName}</small></div><PrintButton/></div><StudentAwatDocument data={data}/></div>;
}
