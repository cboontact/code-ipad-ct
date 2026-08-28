"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBullhorn,
  faChalkboardTeacher,
  faGraduationCap,
} from "@fortawesome/free-solid-svg-icons";
import { IpadProductVisual } from "@/components/public/ipad-product-visual";
import { readJson } from "@/lib/client-json";

type HeroCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroProductName: string;
  heroProductSuffix: string;
  heroFreeLabel: string;
  heroAudience: string;
};

const defaultHeroCopy: HeroCopy = {
  heroEyebrow: "Anywhere Anytime",
  heroTitle: "ลงทะเบียนรับ",
  heroProductName: "iPad",
  heroProductSuffix: "ยืมเรียน",
  heroFreeLabel: "ฟรี!!!",
  heroAudience: "สำหรับครูและนักเรียนโรงเรียนจอมทอง",
};

export function SurveyAudienceGateway(){
  const [hero, setHero] = useState(defaultHeroCopy);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/bootstrap", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => readJson<{ settings?: Partial<HeroCopy> }>(response))
      .then((body) => {
        if (!body.settings) return;
        setHero((current) => ({ ...current, ...body.settings }));
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setHero(defaultHeroCopy);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="shell public-main audience-page">
      <section className="hero audience-main-hero">
        <div>
          <span className="eyebrow"><FontAwesomeIcon icon={faGraduationCap}/> {hero.heroEyebrow}</span>
          <h1>
            <span className="hero-registration-line">{hero.heroTitle}</span>
            <span className="hero-title-line"><em>{hero.heroProductName}</em> {hero.heroProductSuffix} <strong className="free-label">{hero.heroFreeLabel}</strong></span>
            <span className="hero-audience-line">{hero.heroAudience}</span>
          </h1>
          <div className="hero-actions">
            <Link className="hero-detail-link" href="/project">
              <FontAwesomeIcon icon={faBullhorn} />
              ดูรายละเอียด
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        </div>
        <div className="hero-device" aria-hidden="true">
          <IpadProductVisual />
        </div>
      </section>
      <section className="section-heading audience-selection-heading"><div><h2>เลือกประเภทผู้ลงทะเบียน</h2></div><p>เลือกให้ตรงกับสถานะของผู้ใช้งาน</p></section>
      <section className="audience-grid" aria-label="เลือกประเภทผู้ลงทะเบียน">
        <Link href="/teacher" className="audience-card teacher-audience">
          <span className="audience-card-icon"><FontAwesomeIcon icon={faChalkboardTeacher}/></span>
          <div>
            <small>สำหรับบุคลากร</small>
            <h2>ครูและบุคลากร</h2>
            <b>เริ่มลงทะเบียน <FontAwesomeIcon icon={faArrowRight}/></b>
          </div>
        </Link>
        <Link href="/student" className="audience-card student-audience">
          <span className="audience-card-icon"><FontAwesomeIcon icon={faGraduationCap}/></span>
          <div>
            <small>สำหรับนักเรียน</small>
            <h2>นักเรียน</h2>
            <b>เริ่มลงทะเบียน <FontAwesomeIcon icon={faArrowRight}/></b>
          </div>
        </Link>
      </section>
      <p className="audience-help">ข้อมูลที่กรอกจะใช้เพื่อดำเนินโครงการและจัดทำเอกสาร AWAT-03 เท่านั้น</p>
    </main>
  );
}
