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
import { LanguageSwitcher, useLanguage } from "@/components/language-provider";

export function SiteHeader() {
  const { t } = useLanguage();
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
      ? { href: "/", label: t("กลับหน้าลงทะเบียน", "Back to registration"), icon: faArrowLeft }
      : hasAdminSession
        ? { href: "/admin", label: t("แดชบอร์ด", "Dashboard"), icon: faChartPie }
        : { href: "/admin/login", label: t("ผู้ดูแล", "Admin"), icon: faShieldHalved };

  return (
    <>
      <header className="site-header" data-no-auto-translate>
        <div className="header-accent" />
        <div className="shell header-inner">
        <Link href="/" className="brand" aria-label={t("กลับหน้าหลัก", "Back to home")}>
          <Image
            src={`/api/public/logo?v=${logoVersion}`}
            width={64}
            height={64}
            alt={t("ตราโรงเรียนจอมทอง", "Chomthong School emblem")}
            priority
            unoptimized
          />
          <span>
            <strong>{t("ระบบลงทะเบียนรับ iPad", "iPad Loan Registration")}</strong>
            <small>{t("โรงเรียนจอมทอง · สพม.เชียงใหม่", "Chomthong School · Chiang Mai SESA")}</small>
          </span>
        </Link>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={mobileMenuOpen ? t("ปิดเมนู", "Close menu") : t("เปิดเมนู", "Open menu")}
          aria-expanded={mobileMenuOpen}
          aria-controls="public-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} />
        </button>
        <nav className="desktop-navigation" aria-label={t("เมนูหลัก", "Main navigation")}>
          <Link onClick={() => setMobileMenuOpen(false)} className={["/","/teacher","/student"].includes(pathname) ? "active" : ""} href="/">
            <FontAwesomeIcon icon={faClipboardCheck} />{t("ลงทะเบียน", "Register")}
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className={pathname === "/project" ? "active" : ""}
            href="/project"
          >
            <FontAwesomeIcon icon={faBullhorn} />{t("ประชาสัมพันธ์", "News")}
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} className="admin-link" href={accountLink.href}>
            <FontAwesomeIcon icon={accountLink.icon} />
            <span>{accountLink.label}</span>
          </Link>
          <LanguageSwitcher compact />
        </nav>
        </div>
      </header>
      {mobileMenuOpen && (
        <>
          <button className="mobile-menu-backdrop" type="button" aria-label={t("ปิดเมนู", "Close menu")} onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobile-menu-drawer" data-no-auto-translate id="public-navigation" role="dialog" aria-modal="true" aria-label={t("เมนูหลัก", "Main navigation")}>
            <div className="mobile-menu-drawer-header">
              <b>{t("เมนู", "Menu")}</b>
              <button type="button" aria-label={t("ปิดเมนู", "Close menu")} onClick={() => setMobileMenuOpen(false)}><FontAwesomeIcon icon={faXmark}/></button>
            </div>
            <nav className="mobile-navigation">
              <Link onClick={() => setMobileMenuOpen(false)} className={["/","/teacher","/student"].includes(pathname) ? "active" : ""} href="/">
                <FontAwesomeIcon icon={faClipboardCheck} />{t("ลงทะเบียน", "Register")}
              </Link>
              <Link onClick={() => setMobileMenuOpen(false)} className={pathname === "/project" ? "active" : ""} href="/project">
                <FontAwesomeIcon icon={faBullhorn} />{t("ประชาสัมพันธ์", "News")}
              </Link>
              <Link onClick={() => setMobileMenuOpen(false)} className="admin-link" href={accountLink.href}>
                <FontAwesomeIcon icon={accountLink.icon}/><span>{accountLink.label}</span>
              </Link>
              <LanguageSwitcher />
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
