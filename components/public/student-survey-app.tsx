"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCheck,
  faCircleCheck,
  faCircleXmark,
  faClock,
  faGraduationCap,
  faIdCard,
  faLock,
  faMobileScreenButton,
  faPhone,
  faSearch,
  faShieldHalved,
  faSpinner,
  faTriangleExclamation,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";
import {
  isValidStudentIdentityId,
  normalizeStudentIdentityId,
  parseGuardianFullName,
} from "@/lib/validation/survey";
import { NDLP_EMAIL_PATTERN, SCHOOL_EMAIL_PATTERN, isNdlpEmail, isSchoolEmail } from "@/lib/validation/email-domains";
import { studentGradeNumber } from "@/lib/data/student-options";
import { IpadProductVisual } from "@/components/public/ipad-product-visual";
import { IpadAvailabilityCounter } from "@/components/public/ipad-availability-counter";

type Student = {
  id:string; studentCode:string; name:string; gradeLevel:string; room:string;
  classNumber:string; phone:string; email:string; ndlpEmail:string;
};
type SubdistrictOption={subdistrict:string;postalCode:string};
type Pii={
  citizenId:string;houseNo:string;moo:string;soi:string;road:string;
  province:string;district:string;subdistrict:string;postalCode:string;
  guardianFullName:string;guardianPhone:string;
};
type RegistrationStatus={student:Student;decision:"ACCEPT"|"DECLINE";approvalStatus:"PENDING"|"APPROVED"|"REJECTED"|"NOT_REQUIRED";submittedAt:string;approvedAt?:string|null;approvalNote?:string|null};
const blankPii:Pii={citizenId:"",houseNo:"",moo:"",soi:"",road:"",province:"เชียงใหม่",district:"",subdistrict:"",postalCode:"",guardianFullName:"",guardianPhone:""};

export function StudentSurveyApp(){
  const [studentCode,setStudentCode]=useState(""),
    [registrationStatus,setRegistrationStatus]=useState<"OPEN"|"CLOSED"|null>(null),
    [student,setStudent]=useState<Student|null>(null),[token,setToken]=useState(""),
    [decision,setDecision]=useState<"ACCEPT"|"DECLINE"|null>(null),[phone,setPhone]=useState(""),
    [email,setEmail]=useState(""),[ndlpEmail,setNdlpEmail]=useState(""),
    [pii,setPii]=useState<Pii>(blankPii),[privacy,setPrivacy]=useState(false),
    [provinces,setProvinces]=useState<string[]>([]),[districts,setDistricts]=useState<string[]>([]),
    [subdistricts,setSubdistricts]=useState<SubdistrictOption[]>([]),[busy,setBusy]=useState(false),
    [confirm,setConfirm]=useState(false),[registration,setRegistration]=useState<RegistrationStatus|null>(null);
  const isUpperSecondary=student?["4","5","6"].includes(studentGradeNumber(student.gradeLevel)):false;

  useEffect(()=>{
    fetch("/api/public/bootstrap")
      .then(r=>readJson<{settings:{studentSurveyStatus?:string;surveyStatus?:string}}>(r))
      .then(x=>setRegistrationStatus((x.settings.studentSurveyStatus??x.settings.surveyStatus)==="CLOSED"?"CLOSED":"OPEN"))
      .catch(()=>setRegistrationStatus("OPEN"));
    fetch("/api/public/addresses").then(r=>readJson<{provinces:string[]}>(r)).then(x=>setProvinces(x.provinces)).catch(()=>toast.error("โหลดข้อมูลจังหวัดไม่สำเร็จ"));
  },[]);
  useEffect(()=>{
    if(!pii.province){setDistricts([]);return;}
    fetch(`/api/public/addresses?province=${encodeURIComponent(pii.province)}`).then(r=>readJson<{districts:string[]}>(r)).then(x=>setDistricts(x.districts)).catch(()=>toast.error("โหลดข้อมูลอำเภอไม่สำเร็จ"));
  },[pii.province]);
  useEffect(()=>{
    if(!pii.province||!pii.district){setSubdistricts([]);return;}
    const q=new URLSearchParams({province:pii.province,district:pii.district});
    fetch(`/api/public/addresses?${q}`).then(r=>readJson<{subdistricts:SubdistrictOption[]}>(r)).then(x=>setSubdistricts(x.subdistricts)).catch(()=>toast.error("โหลดข้อมูลตำบลไม่สำเร็จ"));
  },[pii.province,pii.district]);

  async function verify(event:FormEvent){
    event.preventDefault();
    if(!studentCode.trim()){toast.warning("กรุณากรอกเลขประจำตัวนักเรียน");return;}
    setBusy(true);
    try{
      const r=await fetch("/api/public/students/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentCode:studentCode.trim()})}),
        data=await readJson<{error?:string;verificationToken?:string;student:Student;alreadyRegistered?:boolean;decision?:"ACCEPT"|"DECLINE";approvalStatus?:RegistrationStatus["approvalStatus"];submittedAt?:string;approvedAt?:string|null;approvalNote?:string|null}>(r);
      if(!r.ok)throw new Error(data.error);
      setStudent(data.student);setPhone(data.student.phone||"");setEmail(data.student.email||"");setNdlpEmail(data.student.ndlpEmail||"");
      if(data.alreadyRegistered&&data.decision&&data.approvalStatus&&data.submittedAt){
        setRegistration({student:data.student,decision:data.decision,approvalStatus:data.approvalStatus,submittedAt:data.submittedAt,approvedAt:data.approvedAt,approvalNote:data.approvalNote});
        toast.success("พบข้อมูลการลงทะเบียนแล้ว");
      }else{
        setToken(data.verificationToken||"");
        toast.success("ยืนยันข้อมูลนักเรียนเรียบร้อยแล้ว");
      }
    }catch(error){toast.error(error instanceof Error?error.message:"ตรวจสอบข้อมูลไม่สำเร็จ");}
    finally{setBusy(false);}
  }
  function validate(){
    if(!/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/.test(phone)){toast.warning("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง");return false;}
    if(decision==="ACCEPT"){
      if(!isSchoolEmail(email)){toast.warning("อีเมลโรงเรียนต้องลงท้ายด้วย @chomthong.ac.th");return false;}
      if(!isNdlpEmail(ndlpEmail)){toast.warning("อีเมล NDLP ต้องลงท้ายด้วย @ndlp.go.th");return false;}
      if(!isValidStudentIdentityId(pii.citizenId)){toast.warning("เลขประจำตัวไม่ถูกต้อง กรุณาตรวจเลขคนไทย 13 หลัก รหัส G หรือเลขที่ขึ้นต้นด้วย 0");return false;}
      if(!pii.houseNo||!pii.province||!pii.district||!pii.subdistrict||!/^\d{5}$/.test(pii.postalCode)){toast.warning("กรุณากรอกที่อยู่ตามทะเบียนบ้านให้ครบ");return false;}
      if(!parseGuardianFullName(pii.guardianFullName)){toast.warning("กรุณากรอกชื่อผู้ปกครองพร้อมคำนำหน้า นาย นาง หรือนางสาว");return false;}
      if(!/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/.test(pii.guardianPhone)){toast.warning("กรุณากรอกเบอร์โทรศัพท์ผู้ปกครองให้ถูกต้อง");return false;}
      if(!privacy){toast.warning("กรุณารับทราบการใช้ข้อมูลส่วนบุคคล");return false;}
    }
    return true;
  }
  async function submit(){
    if(!student||!decision||!validate())return;
    const guardian=parseGuardianFullName(pii.guardianFullName);
    const piiPayload=guardian?{
      citizenId:normalizeStudentIdentityId(pii.citizenId),houseNo:pii.houseNo,moo:pii.moo,soi:pii.soi,road:pii.road,
      province:pii.province,district:pii.district,subdistrict:pii.subdistrict,postalCode:pii.postalCode,
      guardianPrefix:guardian.prefix,guardianName:guardian.name,guardianPhone:pii.guardianPhone,
    }:undefined;
    setBusy(true);
    try{
      const payload={studentId:student.id,decision,phone,email:decision==="ACCEPT"?email.trim():"",ndlpEmail:decision==="ACCEPT"?ndlpEmail.trim():"",privacyAcknowledged:decision==="ACCEPT"?privacy:false,pii:decision==="ACCEPT"?piiPayload:undefined};
      const postSurvey=async(verificationToken:string)=>{
        const response=await fetch("/api/public/students/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,verificationToken})});
        return {response,data:await readJson<{error?:string;studentName:string;submittedAt:string;approvalStatus:RegistrationStatus["approvalStatus"]}>(response)};
      };
      let result=await postSurvey(token);
      if(result.response.status===401){
        const verifyResponse=await fetch("/api/public/students/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentCode:student.studentCode})});
        const verifyData=await readJson<{error?:string;verificationToken?:string}>(verifyResponse);
        if(!verifyResponse.ok||!verifyData.verificationToken)throw new Error(verifyData.error||"กรุณายืนยันตัวตนใหม่อีกครั้ง");
        setToken(verifyData.verificationToken);
        result=await postSurvey(verifyData.verificationToken);
      }
      if(!result.response.ok)throw new Error(result.data.error);
      setConfirm(false);setRegistration({student,decision,approvalStatus:result.data.approvalStatus,submittedAt:result.data.submittedAt});toast.success("บันทึกข้อมูลเรียบร้อยแล้ว");
    }catch(error){toast.error(error instanceof Error?error.message:"บันทึกข้อมูลไม่สำเร็จ");}
    finally{setBusy(false);}
  }
  function reset(){setStudent(null);setToken("");setDecision(null);setPhone("");setEmail("");setNdlpEmail("");setPii(blankPii);setPrivacy(false);setRegistration(null);setStudentCode("");}
  const input=(key:keyof Pii,label:string,props:React.InputHTMLAttributes<HTMLInputElement>={})=>(
    <label className="field"><span>{label}<b>*</b></span><input {...props} value={pii[key]} onChange={e=>setPii({...pii,[key]:e.target.value})}/></label>
  );

  if(registration){
    const approved=registration.approvalStatus==="APPROVED",rejected=registration.approvalStatus==="REJECTED",declined=registration.decision==="DECLINE";
    const icon=approved?faCircleCheck:rejected?faCircleXmark:declined?faTriangleExclamation:faClock;
    const title=approved?"ได้รับอนุมัติแล้ว":rejected?"ไม่ได้รับอนุมัติ":declined?"บันทึกว่าไม่รับ iPad แล้ว":"รอผู้ดูแลอนุมัติ";
    const description=approved?"ผู้ดูแลยืนยันสิทธิ์รับ iPad เรียบร้อยแล้ว":rejected?"คำขอรับ iPad ไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ":declined?"ระบบบันทึกความประสงค์ของนักเรียนเรียบร้อยแล้ว":"ระบบกันโควตา iPad ไว้แล้ว กรุณารอผู้ดูแลตรวจสอบและอนุมัติ";
    return <main className="shell public-main student-survey-page"><IpadAvailabilityCounter audience="student" studentTier={["4","5","6"].includes(studentGradeNumber(registration.student.gradeLevel))?"upper":"lower"}/><section className={`student-approval-card ${approved?"approved":rejected?"rejected":declined?"declined":"awaiting"}`}><div className="student-approval-icon"><FontAwesomeIcon icon={icon}/></div><span className="eyebrow">สถานะการลงทะเบียนรับ iPad</span><h1>{title}</h1><p className="student-approval-name">{registration.student.name}</p><div className="student-approval-facts"><span><small>ชั้น / ห้อง</small><b>{registration.student.gradeLevel}/{registration.student.room}</b></span><span><small>เลขที่</small><b>{registration.student.classNumber||"—"}</b></span><span><small>เลขประจำตัวนักเรียน</small><b>{registration.student.studentCode}</b></span></div><p className="student-approval-description">{description}</p>{registration.approvalNote&&<p className="student-approval-note">หมายเหตุ: {registration.approvalNote}</p>}<button className="button secondary" onClick={reset}><FontAwesomeIcon icon={faArrowLeft}/> ตรวจสอบนักเรียนคนอื่น</button></section></main>;
  }

  if(registrationStatus==="CLOSED") return <main className="shell public-main student-survey-page"><div className="closed-card"><FontAwesomeIcon icon={faClock}/><span>ปิดรับลงทะเบียนนักเรียน</span><h1>ขณะนี้ปิดรับลงทะเบียนสำหรับนักเรียนแล้ว</h1><p>ยังสามารถอ่านรายละเอียดโครงการและเอกสารประชาสัมพันธ์ได้ตามปกติ</p><Link className="button primary" href="/project">ดูรายละเอียดโครงการ</Link></div></main>;

  return <main className="shell public-main student-survey-page">
    <IpadAvailabilityCounter audience="student" studentTier={student?(isUpperSecondary?"upper":"lower"):undefined} />
    {!student&&<section className="flow-card student-lookup-card">
      <Link href="/" className="back"><FontAwesomeIcon icon={faArrowLeft}/> เลือกประเภทผู้ใช้ใหม่</Link>
      <div className="student-lookup-heading"><div className="flow-title student-flow-title"><span className="flow-title-icon"><FontAwesomeIcon icon={faGraduationCap}/></span><div><span className="eyebrow">ลงทะเบียนรับ iPad สำหรับนักเรียน</span><h1>ค้นหาข้อมูลนักเรียน</h1><p>ใช้เลขประจำตัวนักเรียนของโรงเรียนเพื่อค้นหาข้อมูล</p></div></div><IpadProductVisual className="survey-search-ipad"/></div>
      <form className="student-lookup-form" onSubmit={verify}>
        <label className="field"><span><FontAwesomeIcon icon={faIdCard}/> เลขประจำตัวนักเรียน<b>*</b></span><input inputMode="numeric" maxLength={30} placeholder="กรอกเลขประจำตัวนักเรียน" value={studentCode} onChange={e=>setStudentCode(e.target.value.replace(/\D/g,""))}/></label>
        <button className="button primary" disabled={busy}><FontAwesomeIcon icon={busy?faSpinner:faSearch} spin={busy}/> {busy?"กำลังค้นหา...":"ค้นหาข้อมูล"}</button>
        <p className="student-lookup-note"><FontAwesomeIcon icon={faShieldHalved}/> ระบบจะไม่แสดงรายชื่อนักเรียนจนกว่าจะยืนยันข้อมูลตรงกัน</p>
      </form>
    </section>}

    {student&&!decision&&<section className="flow-card student-decision-card">
      <button className="back" onClick={reset}><FontAwesomeIcon icon={faArrowLeft}/> ค้นหานักเรียนคนอื่น</button>
      <div className="student-identity"><span><FontAwesomeIcon icon={faGraduationCap}/></span><div><small>ตรวจสอบข้อมูลนักเรียน</small><h2>{student.name}</h2><p>ชั้น {student.gradeLevel}/{student.room}{student.classNumber?` · เลขที่ ${student.classNumber}`:""} · รหัส {student.studentCode}</p></div></div>
      <h2 className="decision-question">มีความประสงค์รับ iPad หรือไม่?</h2>
      <div className="choice-grid">
        <button className="choice accept" onClick={()=>setDecision("ACCEPT")}><span><FontAwesomeIcon icon={faMobileScreenButton}/></span><b>รับ iPad</b><small>กรอกข้อมูลเพื่อจัดทำเอกสาร AWAT-03</small></button>
        <button className="choice decline" onClick={()=>setDecision("DECLINE")}><span><FontAwesomeIcon icon={faTriangleExclamation}/></span><b>ไม่รับ iPad</b><small>บันทึกว่าไม่ประสงค์รับอุปกรณ์</small></button>
      </div>
    </section>}

    {student&&decision==="DECLINE"&&isUpperSecondary&&<section className="flow-card decline-prompt-card">
      <button className="back" onClick={()=>setDecision(null)}><FontAwesomeIcon icon={faArrowLeft}/> กลับไปเลือกใหม่</button>
      <div className="decline-copy">
        <FontAwesomeIcon icon={faTriangleExclamation}/>
        <span className="eyebrow">คำแนะนำสำหรับนักเรียนมัธยมศึกษาตอนปลาย</span>
        <h2>ขอความอนุเคราะห์รับ iPad และเปิดใช้งาน NDLP ก่อน</h2>
        <div className="decline-guidance" role="note"><FontAwesomeIcon icon={faMobileScreenButton}/><span><strong>{student.name}</strong>ขอความอนุเคราะห์ให้รับอุปกรณ์และเปิดใช้งานบัญชี NDLP ให้เรียบร้อยก่อน หากภายหลังยังประสงค์คืนอุปกรณ์ สามารถบันทึกแบบฟอร์มแจ้งคืนได้ภายหลัง</span></div>
        <button className="button primary decline-accept-button" onClick={()=>setDecision("ACCEPT")}><FontAwesomeIcon icon={faMobileScreenButton}/> รับ iPad และดำเนินการต่อ</button>
      </div>
    </section>}

    {student&&decision&&(decision==="ACCEPT"||!isUpperSecondary)&&<section className="flow-card form-card">
      <button className="back" onClick={()=>setDecision(null)}><FontAwesomeIcon icon={faArrowLeft}/> เปลี่ยนคำตอบ</button>
      <div className={`decision-summary ${decision.toLowerCase()}`}><FontAwesomeIcon icon={decision==="ACCEPT"?faMobileScreenButton:faTriangleExclamation}/><span><small>ความประสงค์</small><b>{decision==="ACCEPT"?"รับ iPad":"ไม่รับ iPad"}</b></span></div>
      <section className="student-profile-summary">
        <header><span>1</span><div><small>ข้อมูลนักเรียน</small><h2>{student.name}</h2></div></header>
        <div className="student-profile-facts">
          <span><small>ระดับชั้น / ห้อง</small><b>{student.gradeLevel}/{student.room}</b></span>
          <span><small>เลขที่</small><b>{student.classNumber||"—"}</b></span>
          <span><small>รหัสนักเรียน</small><b>{student.studentCode}</b></span>
        </div>
      </section>
      <div className="form-grid two student-contact-grid">
        <label className="field"><span><FontAwesomeIcon icon={faPhone}/> เบอร์โทรศัพท์นักเรียน<b>*</b></span><input inputMode="tel" maxLength={10} placeholder="เช่น 0812345678" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))}/></label>
        {decision==="ACCEPT"&&<label className="field"><span>เลขประจำตัวประชาชน / รหัส G<b>*</b></span><input inputMode="text" autoCapitalize="characters" maxLength={15} placeholder="เลข 13 หลัก หรือ G ตามด้วยเลข 12 หลัก" value={pii.citizenId} onChange={e=>setPii({...pii,citizenId:normalizeStudentIdentityId(e.target.value).slice(0,13)})}/><small className="field-hint">คนไทยตรวจสอบเลข 13 หลักตามหลักการ ส่วนเด็กติด G และบุคคลไม่มีสัญชาติไทยรองรับตามเลขทะเบียนการศึกษา</small></label>}
        {decision==="ACCEPT"&&<label className="field"><span>อีเมลโรงเรียน<b>*</b></span><input type="email" pattern={SCHOOL_EMAIL_PATTERN} title="ต้องใช้อีเมล @chomthong.ac.th" placeholder="name@chomthong.ac.th" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
        {decision==="ACCEPT"&&<label className="field"><span>อีเมล NDLP<b>*</b></span><input type="email" pattern={NDLP_EMAIL_PATTERN} title="ต้องใช้อีเมล @ndlp.go.th" placeholder="name@ndlp.go.th" value={ndlpEmail} onChange={e=>setNdlpEmail(e.target.value)}/><small className="field-hint">หากลืมอีเมล NDLP ให้ติดต่อครูวิทยา หรือครูธนา</small></label>}
      </div>
      {decision==="ACCEPT"&&<>
        <div className="form-heading"><span>2</span><div><h2>ข้อมูลผู้ปกครอง</h2><p>กรอกชื่อพร้อมคำนำหน้า ระบบจะแยกข้อมูลให้อัตโนมัติ</p></div></div>
        <div className="form-grid two">
          <label className="field"><span>ชื่อ-นามสกุลผู้ปกครอง (รวมคำนำหน้า)<b>*</b></span><input value={pii.guardianFullName} aria-invalid={Boolean(pii.guardianFullName)&&!parseGuardianFullName(pii.guardianFullName)} placeholder="เช่น นางสาวสมใจ ใจดี" onChange={e=>setPii({...pii,guardianFullName:e.target.value})}/>{pii.guardianFullName&&(parseGuardianFullName(pii.guardianFullName)?<small className="field-hint guardian-prefix-valid">ตรวจพบคำนำหน้า {parseGuardianFullName(pii.guardianFullName)?.prefix}</small>:<small className="error">กรุณาขึ้นต้นด้วย นาย นาง หรือนางสาว และกรอกชื่อ-นามสกุลให้ครบ</small>)}</label>
          {input("guardianPhone","เบอร์โทรศัพท์ผู้ปกครอง",{inputMode:"tel",maxLength:10,placeholder:"เช่น 0812345678"})}
        </div>
        <div className="form-heading"><span>3</span><div><h2>ที่อยู่ตามทะเบียนบ้าน</h2><p>ข้อมูลจะปรากฏในเอกสาร AWAT-03</p></div></div>
        <div className="form-grid three">
          {input("houseNo","บ้านเลขที่",{placeholder:"เช่น 99/9"})}
          <label className="field"><span>หมู่</span><input value={pii.moo} onChange={e=>setPii({...pii,moo:e.target.value})}/></label>
          <label className="field"><span>ซอย</span><input value={pii.soi} onChange={e=>setPii({...pii,soi:e.target.value})}/></label>
          <label className="field"><span>ถนน</span><input value={pii.road} onChange={e=>setPii({...pii,road:e.target.value})}/></label>
          <label className="field"><span>จังหวัด<b>*</b></span><select value={pii.province} onChange={e=>setPii({...pii,province:e.target.value,district:"",subdistrict:"",postalCode:""})}><option value="">เลือกจังหวัด</option>{provinces.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="field"><span>อำเภอ/เขต<b>*</b></span><select value={pii.district} disabled={!pii.province} onChange={e=>setPii({...pii,district:e.target.value,subdistrict:"",postalCode:""})}><option value="">เลือกอำเภอ</option>{districts.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="field"><span>ตำบล/แขวง<b>*</b></span><select value={pii.subdistrict} disabled={!pii.district} onChange={e=>{const m=subdistricts.find(x=>x.subdistrict===e.target.value);setPii({...pii,subdistrict:e.target.value,postalCode:m?.postalCode||""});}}><option value="">เลือกตำบล</option>{subdistricts.map(x=><option key={x.subdistrict}>{x.subdistrict}</option>)}</select></label>
          {input("postalCode","รหัสไปรษณีย์",{inputMode:"numeric",maxLength:5,readOnly:true})}
        </div>
        <label className="privacy-note student-privacy"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><FontAwesomeIcon icon={faLock}/><span>รับทราบว่าข้อมูลนี้ใช้เพื่อดำเนินโครงการและจัดทำเอกสาร AWAT-03 เท่านั้น</span></label>
      </>}
      <div className="sticky-actions"><button className="button primary" onClick={()=>{if(validate())setConfirm(true);}}><FontAwesomeIcon icon={faCheck}/> ตรวจสอบและบันทึก</button></div>
    </section>}

    {confirm&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setConfirm(false);}}><section className="modal" role="dialog" aria-modal="true"><div className="modal-icon"><FontAwesomeIcon icon={faUserGroup}/></div><h2>ยืนยันการลงทะเบียน</h2><p>{student?.name}<br/>เลือก <b>{decision==="ACCEPT"?"รับ iPad":"ไม่รับ iPad"}</b></p><div className="modal-actions"><button className="button primary" disabled={busy} onClick={submit}><FontAwesomeIcon icon={busy?faSpinner:faCheck} spin={busy}/> {busy?"กำลังบันทึก...":"ยืนยันบันทึก"}</button><button className="button secondary" disabled={busy} onClick={()=>setConfirm(false)}>ยกเลิก</button></div></section></div>}
  </main>;
}
