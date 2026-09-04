"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faArrowRotateLeft,
  faBars,
  faChartPie,
  faChartColumn,
  faChalkboardTeacher,
  faClipboardList,
  faFileCircleCheck,
  faBullhorn,
  faGear,
  faListCheck,
  faRightFromBracket,
  faSchool,
  faShieldHalved,
  faSpinner,
  faTriangleExclamation,
  faUserGraduate,
  faUsersGear,
  faUserTie,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { AdminIdentity } from "@/lib/auth/admin";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site-footer";
import {
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_SESSION_HEARTBEAT_MS,
} from "@/lib/auth/session-policy";

const ADMIN_ACTIVITY_KEY = "ct_admin_last_activity";
const ADMIN_HEARTBEAT_KEY = "ct_admin_last_heartbeat";
const links = [
  ["/admin", "แดชบอร์ด", faChartPie],
  ["/admin/results", "ลงทะเบียนครู", faClipboardList],
  ["/admin/student-results", "ลงทะเบียนนักเรียน", faChartColumn],
  ["/admin/document-checkin", "ตรวจรับเอกสาร", faFileCircleCheck],
  ["/admin/teachers", "จัดการครู", faChalkboardTeacher],
  ["/admin/students", "จัดการนักเรียน", faUserGraduate],
  ["/admin/learning-areas", "กลุ่มสาระ", faSchool],
  ["/admin/advisors", "ครูที่ปรึกษา", faUserTie],
  ["/admin/documents", "ประชาสัมพันธ์", faBullhorn],
  ["/admin/returns", "คืน iPad", faArrowRotateLeft],
  ["/admin/settings", "ตั้งค่า", faGear],
  ["/admin/audit", "Audit Log", faListCheck],
] as const;

export function AdminShell({
  admin,
  children,
}: {
  admin: AdminIdentity;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const refreshLogo = () => setLogoVersion(Date.now());
    window.addEventListener("school-logo-updated", refreshLogo);
    return () => window.removeEventListener("school-logo-updated", refreshLogo);
  }, []);
  useEffect(() => {
    let expiring = false;
    let lastPointerWrite = 0;

    const readTimestamp = (key: string) => {
      try {
        return Number(window.localStorage.getItem(key) ?? 0);
      } catch {
        return 0;
      }
    };
    const writeTimestamp = (key: string, value: number) => {
      try {
        window.localStorage.setItem(key, String(value));
      } catch {
        // The server-side idle expiry remains authoritative if storage is unavailable.
      }
    };
    const expireSession = async () => {
      if (expiring) return;
      expiring = true;
      try {
        await fetch("/api/admin/logout", { method: "POST" });
      } catch {
        // Redirect even if the cleanup request cannot reach the server.
      } finally {
        try {
          window.localStorage.removeItem(ADMIN_ACTIVITY_KEY);
          window.localStorage.removeItem(ADMIN_HEARTBEAT_KEY);
        } catch {
          // Ignore private-mode storage failures.
        }
        window.location.replace("/admin/login?reason=idle");
      }
    };
    const heartbeat = async (current: number) => {
      const previousHeartbeat = readTimestamp(ADMIN_HEARTBEAT_KEY);
      if (current - previousHeartbeat < ADMIN_SESSION_HEARTBEAT_MS) return;
      writeTimestamp(ADMIN_HEARTBEAT_KEY, current);
      try {
        const response = await fetch("/api/admin/me", { cache: "no-store" });
        if (response.status === 401) await expireSession();
      } catch {
        // A temporary network failure must not log the administrator out early.
      }
    };
    const checkIdle = () => {
      const current = Date.now();
      const lastActivity = readTimestamp(ADMIN_ACTIVITY_KEY);
      if (lastActivity && current - lastActivity >= ADMIN_IDLE_TIMEOUT_MS) {
        void expireSession();
        return false;
      }
      if (lastActivity && current - lastActivity < 60_000) {
        void heartbeat(current);
      }
      return true;
    };
    const recordActivity = (event?: Event) => {
      const current = Date.now();
      const previousActivity = readTimestamp(ADMIN_ACTIVITY_KEY);
      if (
        event &&
        previousActivity &&
        current - previousActivity >= ADMIN_IDLE_TIMEOUT_MS
      ) {
        void expireSession();
        return;
      }
      if (
        event?.type === "pointermove" &&
        current - lastPointerWrite < 15_000
      )
        return;
      if (event?.type === "pointermove") lastPointerWrite = current;
      writeTimestamp(ADMIN_ACTIVITY_KEY, current);
      void heartbeat(current);
    };
    const returnToPage = () => {
      if (document.visibilityState === "visible" && checkIdle()) {
        recordActivity();
      }
    };

    recordActivity();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true }),
    );
    window.addEventListener("focus", returnToPage);
    document.addEventListener("visibilitychange", returnToPage);
    const timer = window.setInterval(checkIdle, 15_000);
    return () => {
      window.clearInterval(timer);
      events.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity),
      );
      window.removeEventListener("focus", returnToPage);
      document.removeEventListener("visibilitychange", returnToPage);
    };
  }, []);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("ออกจากระบบไม่สำเร็จ");
      toast.success("ออกจากระบบแล้ว");
      window.location.assign("/admin/login");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-mobile-header">
        <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="เปิดเมนูผู้ดูแลระบบ" aria-expanded={mobileMenuOpen}>
          <FontAwesomeIcon icon={faBars}/>
        </button>
        <b>เมนูผู้ดูแลระบบ</b>
      </div>
      <aside className={`admin-sidebar${mobileMenuOpen ? " mobile-open" : ""}`}>
        <button className="admin-sidebar-close" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="ปิดเมนู">
          <FontAwesomeIcon icon={faXmark}/>
        </button>
        <Link href="/admin" className="admin-sidebar-brand" onClick={() => setMobileMenuOpen(false)}>
          <Image
            src={`/api/public/logo?v=${logoVersion}`}
            width={54}
            height={54}
            alt="ตราโรงเรียนจอมทอง"
            unoptimized
          />
          <span>
            <strong>ระบบลงทะเบียนรับ iPad</strong>
            <small>โรงเรียนจอมทอง</small>
          </span>
        </Link>
        <div className="admin-sidebar-label">เมนูผู้ดูแลระบบ</div>
        <nav aria-label="เมนูผู้ดูแลระบบ">
          {links.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className={
                path === href ||
                (href === "/admin/teachers" &&
                  path.startsWith("/admin/teachers/"))
                  ? "active"
                  : ""
              }
              title={label}
            >
              <FontAwesomeIcon icon={icon} />
              <span>{label}</span>
            </Link>
          ))}
          {admin.role === "superadmin" && (
            <Link
              href="/admin/admins"
              onClick={() => setMobileMenuOpen(false)}
              className={path === "/admin/admins" ? "active" : ""}
              title="จัดการผู้ดูแลระบบ"
            >
              <FontAwesomeIcon icon={faUsersGear} />
              <span>จัดการผู้ดูแลระบบ</span>
            </Link>
          )}
          <div className="admin-sidebar-account" title={`${admin.username} · ${admin.role}`}>
            <FontAwesomeIcon icon={faShieldHalved} />
            <span>
              <b>{admin.displayName}</b>
              <small>{admin.username} · {admin.role}</small>
            </span>
          </div>
          <div className="admin-sidebar-actions">
            <Link href="/" className="admin-public-link" title="กลับหน้าลงทะเบียน" onClick={() => setMobileMenuOpen(false)}>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              <span>หน้าลงทะเบียน</span>
            </Link>
            <button
              className="logout-action"
              onClick={() => { setMobileMenuOpen(false); setLogoutConfirm(true); }}
              title="ออกจากระบบ"
            >
              <FontAwesomeIcon icon={faRightFromBracket} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </nav>
      </aside>
      {mobileMenuOpen && <button className="admin-mobile-backdrop" type="button" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)}/>}
      <div className="admin-workspace">
        <main className="admin-content">{children}</main>
        <SiteFooter />
      </div>
      {logoutConfirm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loggingOut) {
              setLogoutConfirm(false);
            }
          }}
        >
          <section
            className="modal logout-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-icon danger-icon">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2 id="logout-confirm-title">ยืนยันการออกจากระบบ</h2>
            <p>ต้องการออกจากระบบผู้ดูแลใช่หรือไม่?</p>
            <div className="modal-actions">
              <button
                className="button secondary"
                disabled={loggingOut}
                onClick={() => setLogoutConfirm(false)}
              >
                ยกเลิก
              </button>
              <button
                className="button danger-solid"
                disabled={loggingOut}
                onClick={logout}
              >
                <FontAwesomeIcon
                  icon={loggingOut ? faSpinner : faRightFromBracket}
                  spin={loggingOut}
                />
                {loggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
