"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBars,
  faBullhorn,
  faChartPie,
  faClipboardCheck,
  faShieldHalved,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

export function SiteHeader() {
  const pathname = usePathname();
  const [hasAdminSession, setHasAdminSession] = useState(false),
    [logoVersion, setLogoVersion] = useState(0),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdminWorkspace =
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") && pathname !== "/admin/login");

  useEffect(() => {
    if (isAdminWorkspace || pathname === "/admin/login") return;
    const controller = new AbortController();
    fetch("/api/admin/me", {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then((response) => setHasAdminSession(response.ok))
      .catch(() => undefined);
    return () => controller.abort();
  }, [isAdminWorkspace, pathname]);
  useEffect(() => {
    const refreshLogo = () => setLogoVersion(Date.now());
    window.addEventListener("school-logo-updated", refreshLogo);
    return () => window.removeEventListener("school-logo-updated", refreshLogo);
  }, []);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  if (isAdminWorkspace) return null;

  const accountLink =
    pathname === "/admin/login"
      ? { href: "/", label: "กลับหน้าลงทะเบียน", icon: faArrowLeft }
      : hasAdminSession
        ? { href: "/admin", label: "แดชบอร์ด", icon: faChartPie }
        : { href: "/admin/login", label: "ผู้ดูแล", icon: faShieldHalved };

  return (
    <>
      <header className="site-header">
        <div className="header-accent" />
        <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="กลับหน้าหลัก">
          <Image
            src={`/api/public/logo?v=${logoVersion}`}
            width={64}
            height={64}
            alt="ตราโรงเรียนจอมทอง"
            priority
            unoptimized
          />
          <span>
            <strong>ระบบลงทะเบียนรับ iPad</strong>
            <small>โรงเรียนจอมทอง · สพม.เชียงใหม่</small>
          </span>
        </Link>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={mobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={mobileMenuOpen}
          aria-controls="public-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} />
        </button>
        <nav className="desktop-navigation" aria-label="เมนูหลัก">
          <Link onClick={() => setMobileMenuOpen(false)} className={["/","/teacher","/student"].includes(pathname) ? "active" : ""} href="/">
            <FontAwesomeIcon icon={faClipboardCheck} />ลงทะเบียน
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className={pathname === "/project" ? "active" : ""}
            href="/project"
          >
            <FontAwesomeIcon icon={faBullhorn} />ประชาสัมพันธ์
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} className="admin-link" href={accountLink.href}>
            <FontAwesomeIcon icon={accountLink.icon} />
            <span>{accountLink.label}</span>
          </Link>
        </nav>
        </div>
      </header>
      {mobileMenuOpen && (
        <>
          <button className="mobile-menu-backdrop" type="button" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobile-menu-drawer" id="public-navigation" role="dialog" aria-modal="true" aria-label="เมนูหลัก">
            <div className="mobile-menu-drawer-header">
              <b>เมนู</b>
              <button type="button" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)}><FontAwesomeIcon icon={faXmark}/></button>
            </div>
            <nav className="mobile-navigation">
              <Link onClick={() => setMobileMenuOpen(false)} className={["/","/teacher","/student"].includes(pathname) ? "active" : ""} href="/">
                <FontAwesomeIcon icon={faClipboardCheck} />ลงทะเบียน
              </Link>
              <Link onClick={() => setMobileMenuOpen(false)} className={pathname === "/project" ? "active" : ""} href="/project">
                <FontAwesomeIcon icon={faBullhorn} />ประชาสัมพันธ์
              </Link>
              <Link onClick={() => setMobileMenuOpen(false)} className="admin-link" href={accountLink.href}>
                <FontAwesomeIcon icon={accountLink.icon}/><span>{accountLink.label}</span>
              </Link>
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
