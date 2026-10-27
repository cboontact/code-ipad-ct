import { requireAdminApi } from "@/lib/auth/admin";
import { ensureDatabase } from "@/lib/db/runtime";
import { getEnv } from "@/lib/cloudflare/env";
import { apiError, json } from "@/lib/http";

export const dynamic="force-dynamic";

export async function GET(_:Request,{params}:{params:Promise<{studentId:string}>}){
  try{
    await requireAdminApi(_);
    const {studentId}=await params,db=await ensureDatabase();
    const row=await db.prepare("SELECT selfie_object_key FROM guardian_training_assignments WHERE student_id=?").bind(studentId).first<{selfie_object_key:string|null}>();
    if(!row?.selfie_object_key)return json({error:"ไม่พบภาพยืนยันตัวตน"},404);
    const object=await getEnv().FILES.get(row.selfie_object_key);
    if(!object)return json({error:"ไม่พบไฟล์ภาพ"},404);
    return new Response(object.body,{headers:{"Content-Type":object.httpMetadata?.contentType??"image/jpeg","Cache-Control":"private, no-store"}});
  }catch(error){return apiError(error);}
}
