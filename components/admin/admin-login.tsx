"use client";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faRightToBracket,
  faSpinner,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { readJson } from "@/lib/client-json";
export function AdminLogin() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("reason") !== "idle") return;
    toast.warning("ออกจากระบบอัตโนมัติ เนื่องจากไม่มีการใช้งานเกิน 30 นาที");
    url.searchParams.delete("reason");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }),
        data = await readJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(data.error);
      toast.success("เข้าสู่ระบบสำเร็จ");
      window.location.assign("/admin");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login-page">
      <section className="login-card">
        <Image
          className="login-logo"
          src="/api/public/logo"
          width={90}
          height={90}
          alt="โรงเรียนจอมทอง"
          unoptimized
        />
        <span className="eyebrow">ระบบสำหรับผู้ดูแล</span>
        <h1>เข้าสู่ระบบ</h1>
        <p>จัดการการลงทะเบียน รายชื่อครู นักเรียน และเอกสารโครงการ</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>
              <FontAwesomeIcon icon={faUser} /> ชื่อผู้ใช้
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>
              <FontAwesomeIcon icon={faLock} /> รหัสผ่าน
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button primary wide" disabled={busy}>
            {busy ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> กำลังเข้าสู่ระบบ...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faRightToBracket} /> เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
