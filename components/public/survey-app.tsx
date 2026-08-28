"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBookOpen,
  faCalculator,
  faCheck,
  faChevronRight,
  faCircleCheck,
  faClock,
  faFlask,
  faHeartPulse,
  faLandmark,
  faLanguage,
  faMagnifyingGlass,
  faMobileScreenButton,
  faPalette,
  faPeopleGroup,
  faShieldHalved,
  faSpinner,
  faTriangleExclamation,
  faUser,
  faUserTie,
  faUsers,
  faBriefcase,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { isValidThaiCitizenId } from "@/lib/validation/survey";
import { NDLP_EMAIL_PATTERN, SCHOOL_EMAIL_PATTERN, isNdlpEmail, isSchoolEmail } from "@/lib/validation/email-domains";
import { readJson } from "@/lib/client-json";
import { IpadProductVisual } from "@/components/public/ipad-product-visual";
import { IpadAvailabilityCounter } from "@/components/public/ipad-availability-counter";
import {
  academicRankOptions,
  positionOptions,
} from "@/lib/data/teacher-options";

type Area = {
  id: string;
  name: string;
  icon: string;
  teacher_count: number;
  responded_count: number;
};
type Teacher = {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  position?: string;
  academic_rank?: string;
  status: "PENDING" | "COMPLETED";
};
type Boot = {
  settings: {
    systemName: string;
    projectName: string;
    schoolName: string;
    organization: string;
    surveyStatus: string;
    teacherSurveyStatus: string;
    studentSurveyStatus: string;
    announcement: string;
    surveyEndDate: string;
  };
  areas: Area[];
};
type Pii = {
  citizenId: string;
  houseNo: string;
  moo: string;
  soi: string;
  road: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};
type TeacherProfile = {
  position: string;
  academicRank: string;
  email: string;
  ndlpEmail: string;
  phone: string;
};
type SubdistrictOption = {
  subdistrict: string;
  postalCode: string;
};
const blankProfile: TeacherProfile = {
  position: "",
  academicRank: "",
  email: "",
  ndlpEmail: "",
  phone: "",
};
const blankPii: Pii = {
  citizenId: "",
  houseNo: "",
  moo: "",
  soi: "",
  road: "",
  subdistrict: "",
  district: "",
  province: "เชียงใหม่",
  postalCode: "",
};
const iconMap: Record<string, typeof faBookOpen> = {
  "book-open": faBookOpen,
  calculator: faCalculator,
  flask: faFlask,
  landmark: faLandmark,
  "heart-pulse": faHeartPulse,
  palette: faPalette,
  briefcase: faBriefcase,
  language: faLanguage,
  "people-group": faPeopleGroup,
  "user-tie": faUserTie,
};
const declineGuidance =
  "ขอความอนุเคราะห์ให้ท่านรับอุปกรณ์และเปิดใช้งานบัญชี NDLP ให้เรียบร้อยก่อน หากภายหลังยังประสงค์คืนอุปกรณ์ สามารถบันทึกแบบฟอร์มแจ้งคืนได้ภายหลัง";

export function SurveyApp() {
  const [boot, setBoot] = useState<Boot | null>(null),
    [loading, setLoading] = useState(true),
    [area, setArea] = useState<Area | null>(null),
    [teachers, setTeachers] = useState<Teacher[]>([]),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Teacher | null>(null),
    [provinces, setProvinces] = useState<string[]>([]),
    [districts, setDistricts] = useState<string[]>([]),
    [subdistricts, setSubdistricts] = useState<SubdistrictOption[]>([]),
    [token, setToken] = useState(""),
    [decision, setDecision] = useState<"ACCEPT" | "DECLINE" | null>(null),
    [profile, setProfile] = useState<TeacherProfile>(blankProfile),
    [pii, setPii] = useState<Pii>(blankPii),
    [privacy, setPrivacy] = useState(false),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [success, setSuccess] = useState<{ name: string; at: string } | null>(null),
    [profileErrors, setProfileErrors] = useState<
      Partial<Record<keyof TeacherProfile, string>>
    >({}),
    [errors, setErrors] = useState<Partial<Record<keyof Pii, string>>>({});
  useEffect(() => {
    fetch("/api/public/bootstrap")
      .then((r) => readJson<Boot>(r))
      .then((data) => setBoot(data))
      .catch(() => toast.error("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/public/addresses")
      .then((response) => readJson<{ provinces: string[] }>(response))
      .then((data) => setProvinces(data.provinces))
      .catch(() => toast.error("โหลดรายชื่อจังหวัดไม่สำเร็จ"));
  }, []);
  useEffect(() => {
    if (!pii.province) return;
    const controller = new AbortController();
    fetch(`/api/public/addresses?province=${encodeURIComponent(pii.province)}`, {
      signal: controller.signal,
    })
      .then((response) => readJson<{ districts: string[] }>(response))
      .then((data) => setDistricts(data.districts))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          toast.error("โหลดรายชื่ออำเภอไม่สำเร็จ");
      });
    return () => controller.abort();
  }, [pii.province]);
  useEffect(() => {
    if (!pii.province || !pii.district) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      province: pii.province,
      district: pii.district,
    });
    fetch(`/api/public/addresses?${query}`, { signal: controller.signal })
      .then((response) =>
        readJson<{ subdistricts: SubdistrictOption[] }>(response),
      )
      .then((data) => setSubdistricts(data.subdistricts))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          toast.error("โหลดรายชื่อตำบลไม่สำเร็จ");
      });
    return () => controller.abort();
  }, [pii.province, pii.district]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) =>
      `${t.prefix}${t.first_name} ${t.last_name} ${t.position ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [search, teachers]);
  async function chooseArea(item: Area) {
    setArea(item);
    setLoading(true);
    try {
      const r = await fetch(`/api/public/areas/${item.id}/teachers`),
        data = await readJson<{ error?: string; teachers: Teacher[] }>(r);
      if (!r.ok) throw new Error(data.error);
      setTeachers(data.teachers);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "โหลดรายชื่อไม่สำเร็จ",
      );
      setArea(null);
    } finally {
      setLoading(false);
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const r = await fetch("/api/public/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId: selected.id }),
        }),
        data = await readJson<{
          error?: string;
          verificationToken: string;
          teacher: TeacherProfile;
        }>(r);
      if (!r.ok) throw new Error(data.error);
      setProfile({
        position: positionOptions.some(
          (position) => position === data.teacher.position,
        )
          ? data.teacher.position
          : "",
        academicRank: academicRankOptions.some(
          (rank) => rank === data.teacher.academicRank,
        )
          ? data.teacher.academicRank
          : "",
        email: data.teacher.email ?? "",
        ndlpEmail: data.teacher.ndlpEmail ?? "",
        phone: data.teacher.phone ?? "",
      });
      setToken(data.verificationToken);
      toast.success("ตรวจสอบรายชื่อเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ตรวจสอบรายชื่อไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  function validateProfile() {
    const next: Partial<Record<keyof TeacherProfile, string>> = {};
    if (!positionOptions.some((position) => position === profile.position))
      next.position = "กรุณาเลือกตำแหน่ง";
    if (!profile.academicRank)
      next.academicRank = "กรุณาเลือกวิทยฐานะ";
    if (!isSchoolEmail(profile.email))
      next.email = "อีเมลโรงเรียนต้องลงท้ายด้วย @chomthong.ac.th";
    if (!isNdlpEmail(profile.ndlpEmail))
      next.ndlpEmail = "อีเมล NDLP ต้องลงท้ายด้วย @ndlp.go.th";
    if (!/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/.test(profile.phone))
      next.phone = "หมายเลขโทรศัพท์ไม่ถูกต้อง";
    setProfileErrors(next);
    return Object.keys(next).length === 0;
  }
  function validatePii() {
    const next: Partial<Record<keyof Pii, string>> = {};
    if (!/^\d{13}$/.test(pii.citizenId) || !isValidThaiCitizenId(pii.citizenId))
      next.citizenId = "เลขประจำตัวประชาชนไม่ถูกต้อง";
    if (!pii.houseNo.trim()) next.houseNo = "กรุณากรอกบ้านเลขที่";
    if (!pii.province) next.province = "กรุณาเลือกจังหวัด";
    if (!pii.district) next.district = "กรุณาเลือกอำเภอ";
    if (!pii.subdistrict) next.subdistrict = "กรุณาเลือกตำบล";
    if (!/^\d{5}$/.test(pii.postalCode))
      next.postalCode = "รหัสไปรษณีย์ต้องมี 5 หลัก";
    setErrors(next);
    if (Object.keys(next).length) {
      setTimeout(() => document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(), 0);
      return false;
    }
    if (!privacy) {
      toast.warning("กรุณารับทราบการใช้ข้อมูลส่วนบุคคล");
      return false;
    }
    return true;
  }
  function prepareSubmit() {
    const profileValid = validateProfile();
    const piiValid = decision !== "ACCEPT" || validatePii();
    if (!profileValid || !piiValid) {
      setTimeout(
        () =>
          document
            .querySelector<HTMLInputElement | HTMLSelectElement>(
              '[aria-invalid="true"]',
            )
            ?.focus(),
        0,
      );
      return;
    }
    setConfirm(true);
  }
  async function submit() {
    if (!selected || !decision) return;
    setBusy(true);
    try {
      const r = await fetch("/api/public/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacherId: selected.id,
            verificationToken: token,
            decision,
            profile,
            privacyAcknowledged: decision === "ACCEPT" ? privacy : false,
            pii: decision === "ACCEPT" ? pii : undefined,
          }),
        }),
        data = await readJson<{
          error?: string;
          teacherName: string;
          submittedAt: string;
        }>(r);
      if (!r.ok) throw new Error(data.error);
      setConfirm(false);
      setSuccess({ name: data.teacherName, at: data.submittedAt });
      toast.success("บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setArea(null);
    setSelected(null);
    setToken("");
    setDecision(null);
    setProfile(blankProfile);
    setPii(blankPii);
    setSuccess(null);
    setSearch("");
    setPrivacy(false);
    setProfileErrors({});
    setErrors({});
    fetch("/api/public/bootstrap")
      .then((r) => readJson<Boot>(r))
      .then(setBoot);
  }
  const field = (
    key: keyof Pii,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="field">
      <span>
        {label}
        {[
          "citizenId",
          "houseNo",
          "subdistrict",
          "district",
          "province",
          "postalCode",
        ].includes(key) && <b>*</b>}
      </span>
      <input
        {...props}
        value={pii[key]}
        aria-invalid={Boolean(errors[key])}
        onChange={(e) => {
          setPii({ ...pii, [key]: e.target.value });
          setErrors({ ...errors, [key]: undefined });
        }}
      />
      {errors[key] && <small className="error">{errors[key]}</small>}
    </label>
  );
  const profileField = (
    key: keyof TeacherProfile,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    hint?: string,
  ) => (
    <label className="field">
      <span>
        {label}<b>*</b>
      </span>
      <input
        {...props}
        value={profile[key]}
        aria-invalid={Boolean(profileErrors[key])}
        onChange={(event) => {
          setProfile({ ...profile, [key]: event.target.value });
          setProfileErrors({ ...profileErrors, [key]: undefined });
        }}
      />
      {profileErrors[key] && (
        <small className="error">{profileErrors[key]}</small>
      )}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
  if (loading && !boot) return <SurveySkeleton />;
  if (!boot)
    return (
      <div className="empty-state">
        <FontAwesomeIcon icon={faTriangleExclamation} />
        <h2>เชื่อมต่อระบบไม่สำเร็จ</h2>
        <button className="button primary" onClick={() => location.reload()}>
          ลองใหม่
        </button>
      </div>
    );
  if ((boot.settings.teacherSurveyStatus ?? boot.settings.surveyStatus) !== "OPEN")
    return (
      <main className="shell public-main">
        <div className="closed-card">
          <FontAwesomeIcon icon={faClock} />
          <span>ปิดรับลงทะเบียนครู</span>
          <h1>ขณะนี้ปิดรับลงทะเบียนสำหรับครูและบุคลากรแล้ว</h1>
          <p>ท่านยังสามารถอ่านรายละเอียดโครงการและเอกสารประกอบได้ตามปกติ</p>
          <a className="button primary" href="/project">
            ดูรายละเอียดโครงการ
          </a>
        </div>
      </main>
    );
  if (success)
    return (
      <main className="shell public-main">
        <div className="success-card">
          <div className="success-icon">
            <FontAwesomeIcon icon={faCircleCheck} />
          </div>
          <span className="eyebrow">ลงทะเบียนสำเร็จ</span>
          <h1>บันทึกข้อมูลเรียบร้อยแล้ว</h1>
          <p className="success-name">{success.name}</p>
          <p>
            บันทึกเมื่อ{" "}
            {new Date(success.at).toLocaleString("th-TH", {
              dateStyle: "long",
              timeStyle: "short",
            })}{" "}
            น.
          </p>
          <div className="privacy-note">
            <FontAwesomeIcon icon={faShieldHalved} />
            ระบบจัดเก็บข้อมูลส่วนบุคคลแบบเข้ารหัสและไม่แสดงต่อสาธารณะ
          </div>
          {decision === "DECLINE" && (
            <div className="decline-guidance" role="note">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              <span>
                <strong>สำหรับผู้แจ้งไม่รับ iPad</strong>
                {declineGuidance}
              </span>
            </div>
          )}
          <button className="button secondary" onClick={reset}>
            กลับหน้าหลัก
          </button>
        </div>
      </main>
    );
  return (
    <main className={`shell public-main teacher-survey-main${!area && !selected ? " area-selection-page" : ""}`}>
      {(area || selected) && <IpadAvailabilityCounter audience="teacher" />}
      {!area && !selected && (
        <>
          <div className="teacher-selection-top">
            <section className="section-heading survey-product-heading">
              <div>
                <span>เริ่มลงทะเบียน</span>
                <h2>เลือกกลุ่มสาระการเรียนรู้</h2>
              </div>
              <p>
                {boot.areas.reduce(
                  (sum, x) => sum + Number(x.responded_count),
                  0,
                )}{" "}
                จาก{" "}
                {boot.areas.reduce((sum, x) => sum + Number(x.teacher_count), 0)}{" "}
                คน ลงทะเบียนแล้ว
              </p>
              <IpadProductVisual className="survey-heading-ipad" />
            </section>
            <IpadAvailabilityCounter audience="teacher" />
          </div>
          <div className="area-grid">
            {boot.areas.map((item) => {
              const total = Number(item.teacher_count),
                done = Number(item.responded_count),
                percent = total ? Math.round((done / total) * 100) : 0;
              return (
                <button
                  key={item.id}
                  className="area-card"
                  onClick={() => chooseArea(item)}
                >
                  <div className="area-icon">
                    <FontAwesomeIcon icon={iconMap[item.icon] ?? faBookOpen} />
                  </div>
                  <div className="area-copy">
                    <h3>{item.name}</h3>
                    <p>
                      <FontAwesomeIcon icon={faUsers} /> ครู {total} คน{" "}
                      <span>·</span> ลงทะเบียนแล้ว {done}
                    </p>
                    <div className="progress">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                    <small>{percent}% สำเร็จ</small>
                  </div>
                  <FontAwesomeIcon className="chevron" icon={faChevronRight} />
                </button>
              );
            })}
          </div>
        </>
      )}
      {area && !selected && (
        <section className="flow-card">
          <button
            className="back"
            onClick={() => {
              setArea(null);
              setSearch("");
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปเลือกกลุ่มสาระ
          </button>
          <div className="teacher-search-heading">
            <div className="flow-title">
              <div className="area-icon">
                <FontAwesomeIcon icon={iconMap[area.icon] ?? faBookOpen} />
              </div>
              <div>
                <span>กลุ่มสาระการเรียนรู้</span>
                <h1>{area.name}</h1>
              </div>
            </div>
            <IpadProductVisual className="survey-search-ipad" />
          </div>
          <div className="teacher-stats">
            <span>
              <b>{teachers.length}</b> ครูทั้งหมด
            </span>
            <span>
              <b className="green">
                {teachers.filter((t) => t.status === "COMPLETED").length}
              </b>{" "}
              ลงทะเบียนแล้ว
            </span>
            <span>
              <b className="amber">
                {teachers.filter((t) => t.status === "PENDING").length}
              </b>{" "}
              ยังไม่ลงทะเบียน
            </span>
          </div>
          <label className="search-box">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อครู..."
              autoFocus
            />
          </label>
          <div className="teacher-list">
            {filtered.map((t) => (
              <button
                key={t.id}
                className="teacher-card"
                disabled={t.status === "COMPLETED"}
                onClick={() => setSelected(t)}
              >
                <span className="avatar">
                  <FontAwesomeIcon icon={faUser} />
                </span>
                <span className="teacher-name">
                  <b>
                    {t.prefix}
                    {t.first_name} {t.last_name}
                  </b>
                  <small>
                    {[t.position, t.academic_rank]
                      .filter(Boolean)
                      .join(" · ") || "ครู"}
                  </small>
                </span>
                <span className={`status ${t.status.toLowerCase()}`}>
                  {t.status === "COMPLETED" ? (
                    <>
                      <FontAwesomeIcon icon={faCheck} /> บันทึกแล้ว
                    </>
                  ) : (
                    "ยังไม่ได้ตอบ"
                  )}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <div className="empty-state small">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
                <p>ไม่พบรายชื่อที่ค้นหา</p>
              </div>
            )}
          </div>
        </section>
      )}
      {selected && !token && (
        <section className="flow-card verify-card">
          <button
            className="back"
            onClick={() => {
              setSelected(null);
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปเลือกรายชื่อ
          </button>
          <div className="verify-icon">
            <FontAwesomeIcon icon={faUser} />
          </div>
          <span className="eyebrow">ตรวจสอบรายชื่อ</span>
          <h1>
            {selected.prefix}
            {selected.first_name} {selected.last_name}
          </h1>
          <p>ตรวจสอบชื่อของท่านแล้วกดดำเนินการต่อ</p>
          <form onSubmit={verify}>
            <button className="button primary wide" disabled={busy}>
              {busy ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  ดำเนินการต่อ <FontAwesomeIcon icon={faChevronRight} />
                </>
              )}
            </button>
          </form>
        </section>
      )}
      {selected && token && !decision && (
        <section className="flow-card decision-card">
          <button className="back" onClick={() => setToken("")}>
            <FontAwesomeIcon icon={faArrowLeft} /> ย้อนกลับ
          </button>
          <span className="eyebrow">กำลังตอบในชื่อ</span>
          <h2>
            {selected.prefix}
            {selected.first_name} {selected.last_name}
          </h2>
          <h1>
            ท่านมีความประสงค์รับ iPad
            <br />
            ตามโครงการหรือไม่
          </h1>
          <div className="choice-grid">
            <button
              className="choice accept"
              onClick={() => setDecision("ACCEPT")}
            >
              <span>
                <FontAwesomeIcon icon={faMobileScreenButton} />
              </span>
              <b>รับ iPad</b>
              <small>กรอกข้อมูลสำหรับจัดทำเอกสารการรับอุปกรณ์</small>
            </button>
            <button
              className="choice decline"
              onClick={() => setDecision("DECLINE")}
            >
              <span>
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </span>
              <b>ไม่รับ iPad</b>
              <small>ดูคำชี้แจงก่อนดำเนินการต่อ</small>
            </button>
          </div>
        </section>
      )}
      {selected && token && decision === "DECLINE" && (
        <section className="flow-card decline-prompt-card">
          <button className="back" onClick={() => setDecision(null)}>
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปเลือกใหม่
          </button>
          <div className="decline-copy">
            <FontAwesomeIcon icon={faTriangleExclamation} />
            <span className="eyebrow">คำแนะนำก่อนแจ้งไม่รับ iPad</span>
            <h2>กรุณารับอุปกรณ์และเปิดใช้งาน NDLP ก่อน</h2>
            <div className="decline-guidance" role="note">
              <FontAwesomeIcon icon={faMobileScreenButton} />
              <span>{declineGuidance}</span>
            </div>
            <button
              className="button primary decline-accept-button"
              onClick={() => setDecision("ACCEPT")}
            >
              <FontAwesomeIcon icon={faMobileScreenButton} />
              รับ iPad และดำเนินการต่อ
            </button>
          </div>
        </section>
      )}
      {selected && token && decision === "ACCEPT" && (
        <section className="flow-card form-card">
          <button className="back" onClick={() => setDecision(null)}>
            <FontAwesomeIcon icon={faArrowLeft} /> เปลี่ยนคำตอบ
          </button>
          <div className={`decision-summary ${decision.toLowerCase()}`}>
            <FontAwesomeIcon
              icon={
                decision === "ACCEPT"
                  ? faMobileScreenButton
                  : faTriangleExclamation
              }
            />
            <span>
              <small>ความประสงค์ของท่าน</small>
              <b>{decision === "ACCEPT" ? "รับ iPad" : "ไม่รับ iPad"}</b>
            </span>
          </div>
          <div className="form-heading">
            <span>1</span>
            <div>
              <h2>ข้อมูลครูและบุคลากร</h2>
              <p>ตรวจสอบและกรอกข้อมูลให้ครบ ระบบจะบันทึกกลับไปยังรายชื่อครู</p>
            </div>
          </div>
          <div className="form-grid two">
            <label className="field">
              <span>
                ตำแหน่ง<b>*</b>
              </span>
              <select
                value={profile.position}
                aria-invalid={Boolean(profileErrors.position)}
                onChange={(event) => {
                  setProfile({ ...profile, position: event.target.value });
                  setProfileErrors({
                    ...profileErrors,
                    position: undefined,
                  });
                }}
              >
                <option value="">เลือกตำแหน่ง</option>
                {positionOptions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
              {profileErrors.position && (
                <small className="error">{profileErrors.position}</small>
              )}
            </label>
            <label className="field">
              <span>
                วิทยฐานะ<b>*</b>
              </span>
              <select
                value={profile.academicRank}
                aria-invalid={Boolean(profileErrors.academicRank)}
                onChange={(event) => {
                  setProfile({
                    ...profile,
                    academicRank: event.target.value,
                  });
                  setProfileErrors({
                    ...profileErrors,
                    academicRank: undefined,
                  });
                }}
              >
                <option value="">เลือกวิทยฐานะ</option>
                {academicRankOptions.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
              {profileErrors.academicRank && (
                <small className="error">{profileErrors.academicRank}</small>
              )}
            </label>
            {profileField("email", "อีเมลโรงเรียน", {
              type: "email",
              maxLength: 180,
              pattern: SCHOOL_EMAIL_PATTERN,
              title: "ต้องใช้อีเมล @chomthong.ac.th",
              placeholder: "name@chomthong.ac.th",
            })}
            {profileField("ndlpEmail", "อีเมล NDLP", {
              type: "email",
              maxLength: 180,
              pattern: NDLP_EMAIL_PATTERN,
              title: "ต้องใช้อีเมล @ndlp.go.th",
              placeholder: "name@ndlp.go.th",
            }, "หากลืมอีเมล NDLP ให้ติดต่อครูวิทยา หรือครูธนา")}
            {profileField("phone", "เบอร์โทรศัพท์", {
              inputMode: "tel",
              maxLength: 10,
              placeholder: "เช่น 0812345678",
            })}
          </div>
          <>
              <div className="form-heading">
                <span>2</span>
                <div>
                  <h2>ข้อมูลส่วนบุคคล</h2>
                  <p>ใช้สำหรับจัดทำเอกสารการรับอุปกรณ์เท่านั้น</p>
                </div>
              </div>
              <div className="form-grid two">
                {field("citizenId", "เลขประจำตัวประชาชน", {
                  inputMode: "numeric",
                  maxLength: 13,
                  placeholder: "กรอกตัวเลข 13 หลัก",
                })}
              </div>
              <div className="form-heading">
                <span>3</span>
                <div>
                  <h2>ที่อยู่ตามทะเบียนบ้าน</h2>
                  <p>กรอกข้อมูลให้ครบถ้วนเพื่อใช้ในแบบฟอร์ม AWAT03</p>
                </div>
              </div>
              <div className="form-grid three">
                {field("houseNo", "บ้านเลขที่", { placeholder: "เช่น 99/9" })}
                {field("moo", "หมู่", { placeholder: "ไม่บังคับ" })}
                {field("soi", "ซอย", { placeholder: "ไม่บังคับ" })}
                {field("road", "ถนน", { placeholder: "ไม่บังคับ" })}
                <label className="field">
                  <span>
                    จังหวัด<b>*</b>
                  </span>
                  <select
                    value={pii.province}
                    disabled={!provinces.length}
                    onChange={(e) => {
                      setDistricts([]);
                      setSubdistricts([]);
                      setPii({
                        ...pii,
                        province: e.target.value,
                        district: "",
                        subdistrict: "",
                        postalCode: "",
                      });
                    }}
                  >
                    <option value="">เลือกจังหวัด</option>
                    {provinces.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  {errors.province && (
                    <small className="error">{errors.province}</small>
                  )}
                </label>
                <label className="field">
                  <span>
                    อำเภอ/เขต<b>*</b>
                  </span>
                  <select
                    value={pii.district}
                    disabled={!pii.province || !districts.length}
                    onChange={(e) => {
                      setSubdistricts([]);
                      setPii({
                        ...pii,
                        district: e.target.value,
                        subdistrict: "",
                        postalCode: "",
                      });
                    }}
                  >
                    <option value="">เลือกอำเภอ</option>
                    {districts.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  {errors.district && (
                    <small className="error">{errors.district}</small>
                  )}
                </label>
                <label className="field">
                  <span>
                    ตำบล/แขวง<b>*</b>
                  </span>
                  <select
                    value={pii.subdistrict}
                    disabled={!pii.district || !subdistricts.length}
                    onChange={(e) => {
                      const match = subdistricts.find(
                        (x) => x.subdistrict === e.target.value,
                      );
                      setPii({
                        ...pii,
                        subdistrict: e.target.value,
                        postalCode: match?.postalCode ?? "",
                      });
                    }}
                  >
                    <option value="">เลือกตำบล</option>
                    {subdistricts.map((x) => (
                      <option key={x.subdistrict}>{x.subdistrict}</option>
                    ))}
                  </select>
                  {errors.subdistrict && (
                    <small className="error">{errors.subdistrict}</small>
                  )}
                </label>
                {field("postalCode", "รหัสไปรษณีย์", {
                  inputMode: "numeric",
                  maxLength: 5,
                  readOnly: true,
                  placeholder: "ระบบเติมให้อัตโนมัติ",
                })}
              </div>
              <label className="privacy-check">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                />
                <span>
                  <b>
                    <FontAwesomeIcon icon={faShieldHalved} />{" "}
                    การคุ้มครองข้อมูลส่วนบุคคล
                  </b>{" "}
                  ข้าพเจ้ารับทราบว่าข้อมูลจะใช้เพื่อดำเนินโครงการและจัดทำเอกสารรับอุปกรณ์
                  โดยจัดเก็บในรูปแบบเข้ารหัส
                </span>
              </label>
          </>
          <div className="sticky-actions">
            <button className="button primary" onClick={prepareSubmit}>
              ตรวจสอบและบันทึก <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </section>
      )}
      {confirm && selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirm(false);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="modal-icon">
              <FontAwesomeIcon
                icon={
                  decision === "ACCEPT"
                    ? faMobileScreenButton
                    : faTriangleExclamation
                }
              />
            </div>
            <h2 id="confirm-title">ยืนยันการบันทึกข้อมูล</h2>
            <p>
              ท่านยืนยันความประสงค์{" "}
              <b>“{decision === "ACCEPT" ? "รับ iPad" : "ไม่รับ iPad"}”</b>
              <br />
              ในชื่อ {selected.prefix}
              {selected.first_name} {selected.last_name}
            </p>
            {decision === "DECLINE" && (
              <div className="decline-guidance compact" role="note">
                <FontAwesomeIcon icon={faMobileScreenButton} />
                <span>{declineGuidance}</span>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                กลับไปตรวจสอบ
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={submit}
              >
                {busy ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin /> กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCheck} /> ยืนยันบันทึก
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function SurveySkeleton() {
  return (
    <main className="shell public-main">
      <div className="skeleton teacher-heading-skeleton" />
      <div className="area-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skeleton area-card" key={i} />
        ))}
      </div>
    </main>
  );
}
