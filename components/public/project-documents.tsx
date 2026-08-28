"use client";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuildingColumns,
  faDownload,
  faFilePdf,
  faFolderOpen,
  faImage,
  faLayerGroup,
  faSchool,
  faSpinner,
  faTabletScreenButton,
  faUpRightFromSquare,
  faUserGraduate,
  faUserTie,
} from "@fortawesome/free-solid-svg-icons";
import { readJson } from "@/lib/client-json";
import { IpadProductVisual } from "@/components/public/ipad-product-visual";
type DocFile = {
  id: string;
  mime_type: string;
  size_bytes: number;
  attachment_order: number;
  created_at: string;
};
type Doc = {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  files: DocFile[];
};
export function ProjectDocuments() {
  const [docs, setDocs] = useState<Doc[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/public/documents")
      .then((r) => readJson<{ documents: Doc[] }>(r))
      .then((data) => {
        setDocs(data.documents ?? []);
      })
      .finally(() => setLoading(false));
  }, []);
  return (
    <main className="shell project-page">
      <section className="project-hero">
        <div className="project-hero-heading">
          <span className="project-hero-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faLayerGroup} />
          </span>
          <div className="project-hero-copy">
            <span className="eyebrow">Anywhere Anytime</span>
            <h1>รายละเอียดโครงการ</h1>
            <p>
              โครงการส่งเสริมการเรียนรู้ขั้นพื้นฐานทุกที่ ทุกเวลา
              เพื่อสนับสนุนครูด้วยเครื่องมือดิจิทัลที่พร้อมใช้ในการจัดการเรียนรู้
            </p>
          </div>
          <IpadProductVisual className="project-hero-ipad" />
        </div>
        <div className="project-facts">
          <article>
            <span className="project-fact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faSchool} />
            </span>
            <div>
              <small>สถานศึกษา</small>
              <strong>โรงเรียนจอมทอง</strong>
            </div>
          </article>
          <article>
            <span className="project-fact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBuildingColumns} />
            </span>
            <div>
              <small>หน่วยงานต้นสังกัด</small>
              <strong>สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาเชียงใหม่</strong>
            </div>
          </article>
          <article>
            <span className="project-fact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faTabletScreenButton} />
            </span>
            <div>
              <small>อุปกรณ์ตามโครงการ</small>
              <strong>Apple iPad A16</strong>
            </div>
          </article>
          <article className="project-allocation-fact">
            <span className="project-fact-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faTabletScreenButton} />
            </span>
            <div>
              <small>โรงเรียนได้รับจัดสรร</small>
              <strong>รวม 1,890 เครื่อง</strong>
              <span className="project-fact-breakdown">
                <span><FontAwesomeIcon icon={faUserTie} /> ครูและบุคลากร 127</span>
                <span><FontAwesomeIcon icon={faUserGraduate} /> นักเรียน 1,763</span>
              </span>
            </div>
          </article>
        </div>
      </section>
      <section className="documents-section">
        <div className="section-heading compact project-documents-heading">
          <div>
            <span>ประชาสัมพันธ์</span>
            <h2>ข่าวสารและเอกสาร</h2>
          </div>
          {!loading && docs.length > 0 && <p>{docs.length} รายการ</p>}
        </div>
        {loading ? (
          <div className="pdf-panel project-documents-loading">
            <FontAwesomeIcon icon={faSpinner} spin /> กำลังโหลดเอกสาร...
          </div>
        ) : docs.length ? (
          <div className="documents-stack">
            {docs.map((doc) => {
              const firstFile = doc.files[0];
              if (!firstFile) return null;
              const isImage = doc.files.every((file) =>
                file.mime_type.startsWith("image/"),
              );
              const totalSize = doc.files.reduce(
                (sum, file) => sum + Number(file.size_bytes),
                0,
              );
              return (
              <article className={`pdf-panel public-document-panel${isImage ? " image-publication" : ""}`} key={doc.id}>
                <div className="pdf-toolbar">
                  <div>
                    <h2><FontAwesomeIcon icon={isImage ? faImage : faFilePdf} /> {doc.title}</h2>
                    {doc.description && <p>{doc.description}</p>}
                    <small>
                      {doc.files.length > 1 && `${doc.files.length} รูป · `}
                      {(totalSize / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {new Date(doc.created_at).toLocaleDateString("th-TH")}
                    </small>
                  </div>
                  {doc.files.length === 1 && <span>
                    <a
                      className="button secondary"
                      target="_blank"
                      rel="noreferrer"
                      href={`/api/public/documents/${firstFile.id}/file`}
                    >
                      <FontAwesomeIcon icon={faUpRightFromSquare} /> {isImage ? "เปิดรูปภาพ" : "เปิดเอกสาร"}
                    </a>
                    <a
                      className="button primary"
                      download
                      href={`/api/public/documents/${firstFile.id}/file`}
                    >
                      <FontAwesomeIcon icon={faDownload} /> ดาวน์โหลด
                    </a>
                  </span>}
                </div>
                {isImage ? (
                  <div className={`public-document-image-gallery${doc.files.length === 1 ? " single" : ""}`}>
                    {doc.files.map((file, index) => (
                      <a
                        className="public-document-image-wrap"
                        href={`/api/public/documents/${file.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        key={file.id}
                        aria-label={`เปิด ${doc.title} รูปที่ ${index + 1}`}
                      >
                        {/* Uploaded images have no dimensions until the browser reads the R2 object. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/public/documents/${file.id}/file`}
                          alt={`${doc.title} รูปที่ ${index + 1}`}
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <iframe
                    title={`ตัวอย่าง ${doc.title}`}
                    src={`/api/public/documents/${firstFile.id}/file#toolbar=1&navpanes=0`}
                  />
                )}
              </article>
              );
            })}
          </div>
        ) : (
          <div className="pdf-panel empty-state project-documents-empty">
            <FontAwesomeIcon icon={faFolderOpen} />
            <h3>ยังไม่มีรายการประชาสัมพันธ์</h3>
            <p>รูปภาพหรือเอกสารที่ผู้ดูแลเปิดใช้งานจะแสดงที่นี่โดยอัตโนมัติ</p>
          </div>
        )}
      </section>
    </main>
  );
}
