"use client";
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBookOpen,
  faCamera,
  faCheck,
  faCircleCheck,
  faClock,
  faFilePdf,
  faGraduationCap,
  faIdCard,
  faPlay,
  faSearch,
  faShieldHalved,
  faSpinner,
  faUpload,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";

type Question = { id: string; statement: string; sort_order: number };
type TrainingSession = {
  token: string;
  student: {
    id: string;
    studentCode: string;
    name: string;
    gradeLevel: string;
    room: string;
    classNumber: string;
  };
  guardianName: string;
  guardianPhone: string;
  relationship: string;
  status: string;
  cycle: number;
  watchedSeconds: number;
  videoDuration: number;
  quizScore: number | null;
  quizAttempts: number;
  hasSelfie: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  videoId: string;
  materialUrl: string;
  passScore: number;
  questions: Question[];
  passed?: boolean;
  score?: number;
  incorrectQuestionIds?: string[];
};
type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    id: string,
    options: {
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onReady: (event: { target: YTPlayer }) => void;
        onStateChange: (event: { data: number; target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const statusLabels: Record<string, string> = {
  ASSIGNED: "รอเริ่มอบรม",
  IN_PROGRESS: "กำลังรับชม",
  VIDEO_COMPLETED: "รอทำแบบทดสอบ",
  QUIZ_FAILED: "แก้คำตอบแบบทดสอบ",
  QUIZ_PASSED: "ผ่านแบบทดสอบ",
  REVIEW_PENDING: "รอโรงเรียนตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ส่งข้อมูลใหม่",
};

export function GuardianTrainingApp() {
  const [studentCode, setStudentCode] = useState(""),
    [guardianPhone, setGuardianPhone] = useState(""),
    [session, setSession] = useState<TrainingSession | null>(null),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [answers, setAnswers] = useState<Record<string, boolean>>({}),
    [incorrectQuestionIds, setIncorrectQuestionIds] = useState<string[]>([]),
    [relationship, setRelationship] = useState(""),
    [consent, setConsent] = useState(false),
    [preview, setPreview] = useState("");
  const playerRef = useRef<YTPlayer | null>(null),
    sessionRef = useRef<TrainingSession | null>(null),
    progressBusy = useRef(false);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("guardian-training-token");
    if (!savedToken) return;
    let cancelled = false;
    void post({ action: "status", token: savedToken })
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        setRelationship(data.relationship || "");
      })
      .catch(() => {
        window.localStorage.removeItem("guardian-training-token");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function post(payload: Record<string, unknown>) {
    const response = await fetch("/api/public/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readJson<TrainingSession & { error?: string }>(response);
    if (!response.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
    return data;
  }
  async function lookup(event: FormEvent) {
    event.preventDefault();
    if (!studentCode.trim() || !guardianPhone.trim()) {
      toast.warning("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setBusy(true);
    try {
      const data = await post({
        action: "lookup",
        studentCode: studentCode.trim(),
        guardianPhone,
      });
      setSession(data);
      window.localStorage.setItem("guardian-training-token", data.token);
      setRelationship(data.relationship || "");
      toast.success("ยืนยันข้อมูลเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ตรวจสอบข้อมูลไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  async function sendProgress(ended = false) {
    const current = sessionRef.current,
      player = playerRef.current;
    if (!current || !player || progressBusy.current) return;
    const duration = player.getDuration(),
      position = player.getCurrentTime();
    if (!duration) return;
    progressBusy.current = true;
    try {
      const data = await post({
        action: "progress",
        token: current.token,
        position,
        duration,
        playing: ended || playing,
        ended,
      });
      setSession(data);
    } catch {
      /* A later heartbeat can retry. */
    } finally {
      progressBusy.current = false;
    }
  }

  useEffect(() => {
    if (
      !session ||
      !["ASSIGNED", "IN_PROGRESS"].includes(session.status) ||
      !session.videoId
    )
      return;
    let disposed = false;
    const create = () => {
      if (disposed || !window.YT || playerRef.current) return;
      playerRef.current = new window.YT.Player("guardian-training-player", {
        videoId: session.videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => undefined,
          onStateChange: (event) => {
            if (!window.YT) return;
            const isPlaying = event.data === window.YT.PlayerState.PLAYING;
            setPlaying(isPlaying);
            if (event.data === window.YT.PlayerState.ENDED)
              void sendProgress(true);
          },
        },
      });
    };
    if (window.YT) create();
    else {
      window.onYouTubeIframeAPIReady = create;
      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
      ) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }
    return () => {
      disposed = true;
      setPlaying(false);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [session?.status, session?.videoId]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => void sendProgress(false), 10000);
    return () => window.clearInterval(timer);
  }, [playing]);

  async function submitQuiz() {
    if (!session || Object.keys(answers).length !== session.questions.length) {
      toast.warning("กรุณาตอบให้ครบทั้ง 10 ข้อ");
      return;
    }
    setBusy(true);
    try {
      const data = await post({
        action: "quiz",
        token: session.token,
        answers,
      });
      setSession(data);
      if (data.passed) {
        setAnswers({});
        setIncorrectQuestionIds([]);
        toast.success("ตอบถูกครบ 10 ข้อ ผ่านแบบทดสอบแล้ว");
      } else {
        setIncorrectQuestionIds(data.incorrectQuestionIds || []);
        toast.error(
          `ตอบถูก ${data.score}/10 ข้อ กรุณาแก้คำตอบที่ยังไม่ถูกแล้วส่งใหม่`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ส่งคำตอบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || !session) return;
    if (!consent) {
      toast.warning("กรุณาอ่านและยอมรับ PDPA ก่อนอัปโหลดภาพ");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.warning("กรุณาเลือกไฟล์ภาพ");
      return;
    }
    setBusy(true);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const form = new FormData();
      form.set("token", session.token);
      form.set("pdpaConsent", "true");
      form.set("selfie", file);
      const response = await fetch("/api/public/training/selfie", {
        method: "POST",
        body: form,
      });
      const data = await readJson<{ success?: boolean; error?: string }>(
        response,
      );
      if (!response.ok) throw new Error(data.error);
      setSession((current) =>
        current ? { ...current, hasSelfie: true } : current,
      );
      toast.success("อัปโหลดภาพยืนยันตัวตนแล้ว");
    } catch (error) {
      setPreview("");
      toast.error(
        error instanceof Error ? error.message : "อัปโหลดภาพไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitIdentity() {
    if (!session || !relationship || !consent || !session.hasSelfie) {
      toast.warning("กรุณากรอกข้อมูล ถ่ายภาพ และยอมรับเงื่อนไขให้ครบ");
      return;
    }
    setBusy(true);
    try {
      setSession(
        await post({
          action: "submitIdentity",
          token: session.token,
          relationship,
          consent: true,
        }),
      );
      toast.success("ส่งข้อมูลให้โรงเรียนตรวจสอบแล้ว");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ส่งข้อมูลไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setSession(null);
    setStudentCode("");
    setGuardianPhone("");
    setAnswers({});
    setIncorrectQuestionIds([]);
    setRelationship("");
    setConsent(false);
    setPreview("");
    window.localStorage.removeItem("guardian-training-token");
  }

  if (!session)
    return (
      <main className="shell public-main training-page">
        <section className="training-hero">
          <span className="training-hero-icon">
            <FontAwesomeIcon icon={faGraduationCap} />
          </span>
          <div>
            <span className="eyebrow">อบรมออนไลน์สำหรับผู้ปกครอง</span>
            <h1>อบรมทดแทนการเข้าร่วมประชุม</h1>
            <p>
              สำหรับผู้ปกครองของนักเรียนที่โรงเรียนกำหนดให้เข้ารับการอบรมก่อนดำเนินการรับ
              iPad
            </p>
          </div>
        </section>
        <section className="flow-card training-lookup-card">
          <Link href="/" className="back">
            <FontAwesomeIcon icon={faArrowLeft} /> กลับหน้าหลัก
          </Link>
          <div className="flow-title">
            <span className="flow-title-icon">
              <FontAwesomeIcon icon={faUserGroup} />
            </span>
            <div>
              <span className="eyebrow">ยืนยันผู้เข้าอบรม</span>
              <h2>ค้นหาข้อมูลนักเรียน</h2>
              <p>
                ใช้เลขประจำตัวนักเรียนและเบอร์โทรศัพท์ผู้ปกครองที่ลงทะเบียนไว้
              </p>
            </div>
          </div>
          <form className="training-lookup-form" onSubmit={lookup}>
            <label className="field">
              <span>
                <FontAwesomeIcon icon={faIdCard} /> เลขประจำตัวนักเรียน
              </span>
              <input
                inputMode="numeric"
                maxLength={30}
                value={studentCode}
                onChange={(event) =>
                  setStudentCode(event.target.value.replace(/\D/g, ""))
                }
                placeholder="กรอกเลขประจำตัวนักเรียน"
              />
            </label>
            <label className="field">
              <span>เบอร์โทรศัพท์ผู้ปกครอง</span>
              <input
                inputMode="tel"
                maxLength={10}
                value={guardianPhone}
                onChange={(event) =>
                  setGuardianPhone(event.target.value.replace(/\D/g, ""))
                }
                placeholder="เช่น 0812345678"
              />
            </label>
            <button className="button primary" disabled={busy}>
              <FontAwesomeIcon icon={busy ? faSpinner : faSearch} spin={busy} />
              {busy ? "กำลังตรวจสอบ..." : "เริ่มตรวจสอบสิทธิ์"}
            </button>
          </form>
          <p className="student-lookup-note">
            <FontAwesomeIcon icon={faShieldHalved} />{" "}
            เปิดให้เข้าอบรมเฉพาะรายชื่อที่โรงเรียนกำหนดเท่านั้น
          </p>
        </section>
      </main>
    );

  const percent = session.videoDuration
    ? Math.min(
        100,
        Math.round((session.watchedSeconds / session.videoDuration) * 100),
      )
    : 0;
  const identityStage =
    session.status === "QUIZ_PASSED" || session.status === "REJECTED";
  return (
    <main className="shell public-main training-page">
      <section className="training-session-header">
        <div>
          <span className="eyebrow">การอบรมผู้ปกครอง</span>
          <h1>{session.student.name}</h1>
          <p>
            {session.student.gradeLevel}/{session.student.room} เลขที่{" "}
            {session.student.classNumber || "—"} · รหัส{" "}
            {session.student.studentCode}
          </p>
        </div>
        <div className={`training-status ${session.status.toLowerCase()}`}>
          {statusLabels[session.status] || session.status}
        </div>
        <button className="button secondary" onClick={reset}>
          <FontAwesomeIcon icon={faArrowLeft} /> เปลี่ยนนักเรียน
        </button>
      </section>
      <div className="training-steps">
        <span
          className={
            [
              "ASSIGNED",
              "IN_PROGRESS",
              "VIDEO_COMPLETED",
              "QUIZ_FAILED",
              "QUIZ_PASSED",
              "REVIEW_PENDING",
              "APPROVED",
              "REJECTED",
            ].includes(session.status)
              ? "active"
              : ""
          }
        >
          1 รับชมวิดีโอ
        </span>
        <span
          className={
            [
              "VIDEO_COMPLETED",
              "QUIZ_FAILED",
              "QUIZ_PASSED",
              "REVIEW_PENDING",
              "APPROVED",
              "REJECTED",
            ].includes(session.status)
              ? "active"
              : ""
          }
        >
          2 แบบทดสอบ
        </span>
        <span
          className={
            ["QUIZ_PASSED", "REVIEW_PENDING", "APPROVED", "REJECTED"].includes(
              session.status,
            )
              ? "active"
              : ""
          }
        >
          3 ยืนยันตัวตน
        </span>
        <span className={session.status === "APPROVED" ? "active" : ""}>
          4 โรงเรียนอนุมัติ
        </span>
      </div>
      {["ASSIGNED", "IN_PROGRESS"].includes(session.status) && (
        <section className="flow-card training-video-card">
          <header>
            <div>
              <span className="eyebrow">รอบที่ {session.cycle}</span>
              <h2>
                <FontAwesomeIcon icon={faPlay} /> รับชมวิดีโออย่างน้อย 70%
              </h2>
              <p>
                ระบบบันทึกเวลารับชมจริง เมื่อครบ 70% จะเปิดแบบทดสอบให้ทันที
              </p>
            </div>
            <a
              className="button secondary"
              href={session.materialUrl}
              target="_blank"
              rel="noopener"
            >
              <FontAwesomeIcon icon={faFilePdf} /> เอกสารประกอบ
            </a>
          </header>
          <div className="training-video-frame">
            <div id="guardian-training-player" />
          </div>
          <div className="training-progress">
            <div>
              <i style={{ width: `${percent}%` }} />
            </div>
            <span>
              รับชมแล้วประมาณ <b>{percent}%</b>
            </span>
          </div>
          <div className="training-video-note">
            <FontAwesomeIcon icon={faClock} /> รับชมอย่างน้อย 70%
            ระบบจะเปิดแบบทดสอบโดยอัตโนมัติ
          </div>
        </section>
      )}
      {["VIDEO_COMPLETED", "QUIZ_FAILED"].includes(session.status) && (
        <section className="flow-card training-quiz-card">
          <header>
            <span className="training-section-icon">
              <FontAwesomeIcon icon={faBookOpen} />
            </span>
            <div>
              <span className="eyebrow">แบบทดสอบถูก–ผิด</span>
              <h2>ตอบให้ถูกครบทั้ง 10 ข้อ</h2>
              <p>
                หากมีข้อที่ยังไม่ถูก ระบบจะแจ้งให้แก้ไขและส่งคำตอบใหม่ได้ทันที
              </p>
            </div>
          </header>
          <div className="training-question-list">
            {session.questions.map((question, index) => (
              <fieldset
                key={question.id}
                className={
                  incorrectQuestionIds.includes(question.id) ? "incorrect" : ""
                }
              >
                <legend>
                  <span>{index + 1}</span>
                  <strong>{question.statement}</strong>
                </legend>
                <div className="training-question-options">
                  <label
                    className={answers[question.id] === true ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === true}
                      onChange={() => {
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: true,
                        }));
                        setIncorrectQuestionIds((current) =>
                          current.filter((id) => id !== question.id),
                        );
                      }}
                    />
                    ถูก
                  </label>
                  <label
                    className={answers[question.id] === false ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === false}
                      onChange={() => {
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: false,
                        }));
                        setIncorrectQuestionIds((current) =>
                          current.filter((id) => id !== question.id),
                        );
                      }}
                    />
                    ผิด
                  </label>
                </div>
                {incorrectQuestionIds.includes(question.id) && (
                  <small className="training-question-error">
                    คำตอบข้อนี้ยังไม่ถูก กรุณาเลือกใหม่
                  </small>
                )}
              </fieldset>
            ))}
          </div>
          <button
            className="button primary training-submit-button"
            disabled={busy}
            onClick={submitQuiz}
          >
            <FontAwesomeIcon icon={busy ? faSpinner : faCheck} spin={busy} />
            {busy ? "กำลังตรวจคำตอบ..." : "ส่งคำตอบทั้ง 10 ข้อ"}
          </button>
        </section>
      )}
      {identityStage && (
        <section className="flow-card training-identity-card">
          <header>
            <span className="training-section-icon">
              <FontAwesomeIcon icon={faCamera} />
            </span>
            <div>
              <span className="eyebrow">ยืนยันตัวตนผู้ปกครอง</span>
              <h2>
                {session.status === "REJECTED"
                  ? "แก้ไขและส่งข้อมูลใหม่"
                  : "ถ่ายภาพสดและยืนยันข้อมูล"}
              </h2>
              <p>
                ภาพจะใช้สำหรับให้เจ้าหน้าที่โรงเรียนตรวจสอบการเข้าอบรมเท่านั้น
              </p>
            </div>
          </header>
          {session.reviewNote && (
            <div className="training-review-note">
              <b>เหตุผลที่ต้องส่งใหม่</b>
              <span>{session.reviewNote}</span>
            </div>
          )}
          <div className="training-guardian-summary">
            <span>
              <small>ผู้ปกครอง</small>
              <b>{session.guardianName}</b>
            </span>
            <span>
              <small>เบอร์โทรศัพท์</small>
              <b>{session.guardianPhone}</b>
            </span>
          </div>
          <label className="field">
            <span>ความสัมพันธ์กับนักเรียน</span>
            <select
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
            >
              <option value="">เลือกความสัมพันธ์</option>
              <option>บิดา</option>
              <option>มารดา</option>
              <option>ผู้ปกครอง</option>
              <option>ญาติ</option>
            </select>
          </label>
          <div className="training-pdpa-notice">
            <h3>
              <FontAwesomeIcon icon={faShieldHalved} />
              หนังสือแจ้งการคุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </h3>
            <p>
              โรงเรียนจอมทองเก็บชื่อ เบอร์โทรศัพท์ ความสัมพันธ์ ผลการอบรม
              และภาพยืนยันตัวตน เพื่อยืนยันผู้เข้าอบรม ตรวจสอบสิทธิ์
              และดำเนินโครงการยืม iPad เท่านั้น
              ข้อมูลจะเปิดให้เฉพาะเจ้าหน้าที่ที่ได้รับมอบหมาย
              เก็บรักษาตามระยะเวลาที่จำเป็นของโครงการ
              และไม่เปิดเผยแก่บุคคลภายนอกเว้นแต่กฎหมายกำหนด
            </p>
            <p>
              เจ้าของข้อมูลสามารถขอเข้าถึง แก้ไข
              หรือถอนความยินยอมได้โดยติดต่อโรงเรียน
              ทั้งนี้การถอนความยินยอมอาจทำให้ไม่สามารถตรวจสอบการอบรมผ่านระบบออนไลน์ได้
            </p>
          </div>
          <label className="privacy-note student-privacy">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <FontAwesomeIcon icon={faShieldHalved} />
            <span>
              ข้าพเจ้าได้อ่านและรับทราบรายละเอียด PDPA ข้างต้น
              และยินยอมให้โรงเรียนเก็บ ใช้
              และประมวลผลข้อมูลส่วนบุคคลและภาพยืนยันตัวตน
              เพื่อการอบรมและการดำเนินโครงการยืม iPad
            </span>
          </label>
          <div className="training-selfie-box">
            {preview ? (
              <img src={preview} alt="ภาพยืนยันตัวตนผู้ปกครอง" />
            ) : (
              <div>
                <FontAwesomeIcon icon={faCamera} />
                <b>
                  {session.hasSelfie
                    ? "มีภาพยืนยันตัวตนแล้ว"
                    : "ยังไม่มีภาพยืนยันตัวตน"}
                </b>
                <span>กรุณาถ่ายภาพใบหน้าปัจจุบันให้เห็นชัดเจน</span>
              </div>
            )}
            <label className={`button secondary${consent ? "" : " disabled"}`}>
              <FontAwesomeIcon icon={faUpload} />
              {session.hasSelfie
                ? "ถ่ายหรือเลือกรูปใหม่"
                : "ถ่ายภาพยืนยันตัวตน"}
              <input
                type="file"
                hidden
                disabled={!consent}
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={(event) => void upload(event.target.files?.[0])}
              />
            </label>
            {!consent && <small>กรุณายอมรับ PDPA ก่อนถ่ายหรืออัปโหลดภาพ</small>}
          </div>
          <button
            className="button primary training-submit-button"
            disabled={busy}
            onClick={submitIdentity}
          >
            <FontAwesomeIcon icon={busy ? faSpinner : faCheck} spin={busy} />
            {busy ? "กำลังส่งข้อมูล..." : "ส่งให้โรงเรียนตรวจสอบ"}
          </button>
        </section>
      )}
      {session.status === "REVIEW_PENDING" && (
        <section className="flow-card training-result-card pending">
          <FontAwesomeIcon icon={faClock} />
          <span className="eyebrow">ส่งข้อมูลแล้ว</span>
          <h2>รอโรงเรียนตรวจสอบและอนุมัติ</h2>
          <p>
            เมื่อตรวจสอบเรียบร้อยแล้ว
            สามารถกลับมากรอกเลขประจำตัวนักเรียนเพื่อติดตามผลได้
          </p>
        </section>
      )}
      {session.status === "APPROVED" && (
        <section className="flow-card training-result-card approved">
          <FontAwesomeIcon icon={faCircleCheck} />
          <span className="eyebrow">ผ่านการอบรมแล้ว</span>
          <h2>โรงเรียนอนุมัติเรียบร้อย</h2>
          <p>
            ขั้นตอนถัดไปให้พิมพ์เอกสาร AWAT-03
            นำไปให้ผู้ปกครองและครูที่ปรึกษาลงนาม แล้วส่งเอกสารให้โรงเรียนตรวจรับ
          </p>
          <Link
            className="button primary"
            href="/student/print"
            target="_blank"
          >
            <FontAwesomeIcon icon={faFilePdf} /> พิมพ์เอกสาร AWAT-03
          </Link>
        </section>
      )}
    </main>
  );
}
