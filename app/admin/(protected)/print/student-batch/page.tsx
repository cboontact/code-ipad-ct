import { PrintButton } from "@/components/admin/print-button";
import { StudentAwatDocument } from "@/components/admin/student-awat-document";
import { getAcceptedStudentIds, getPrintableStudent } from "@/lib/db/student-print";
import "../print.css";

type StudentBatchSearchParams = {
  embed?: string;
  search?: string;
  grade?: string;
  room?: string;
  status?: string;
  approval?: string;
};

export default async function StudentBatchPrintPage({searchParams}:{searchParams:Promise<StudentBatchSearchParams>}) {
  const {embed,search,grade,room,status,approval}=await searchParams;
  const ids = await getAcceptedStudentIds({search,grade,room,status,approval});
  const items = (await Promise.all(ids.map(getPrintableStudent))).filter(Boolean);
  return (
    <div className={`print-stage${embed==="1"?" print-embed":""}`}>
      <div className="print-toolbar no-print">
        <div>
          <b>พิมพ์ AWAT-03 นักเรียนแบบชุด</b>
          <small>นักเรียนผู้รับ iPad จำนวน {items.length} คน</small>
        </div>
        <PrintButton />
      </div>
      {items.map(item => <StudentAwatDocument key={item!.id} data={item!} />)}
    </div>
  );
}
