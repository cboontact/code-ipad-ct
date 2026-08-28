"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleExclamation,
  faTabletScreenButton,
} from "@fortawesome/free-solid-svg-icons";
import { readJson } from "@/lib/client-json";

type Audience = "teacher" | "student";
type Inventory = Record<
  Audience,
  {
    capacity: number;
    assigned: number;
    remaining: number;
    upperSecondaryTotal?: number;
    upperSecondaryAssigned?: number;
    upperSecondaryReserved?: number;
    upperSecondaryRemaining?: number;
    lowerSecondaryCapacity?: number;
    lowerSecondaryAssigned?: number;
    lowerSecondaryRemaining?: number;
    lowerSecondaryAvailable?: number;
  }
>;

export function IpadAvailabilityCounter({
  audience,
  studentTier,
}: {
  audience: Audience;
  studentTier?: "lower" | "upper";
}) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/public/inventory", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await readJson<Inventory>(response);
        if (!response.ok) throw new Error("INVENTORY_UNAVAILABLE");
        setInventory(data);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };

    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const item = inventory?.[audience];
  const audienceLabel = audience === "teacher" ? "ครูและบุคลากร" : "นักเรียน";
  const isLowerSecondary = audience === "student" && studentTier === "lower";
  const isUpperSecondary = audience === "student" && studentTier === "upper";
  const displayedRemaining = isLowerSecondary
    ? (item?.lowerSecondaryRemaining ?? item?.lowerSecondaryAvailable ?? item?.remaining)
    : isUpperSecondary
      ? (item?.upperSecondaryRemaining ?? item?.upperSecondaryReserved ?? item?.remaining)
      : item?.remaining;
  const displayedCapacity = isLowerSecondary
    ? (item?.lowerSecondaryCapacity ?? item?.capacity)
    : isUpperSecondary
      ? (item?.upperSecondaryTotal ?? item?.capacity)
      : item?.capacity;
  const displayedAssigned = isLowerSecondary
    ? (item?.lowerSecondaryAssigned ?? item?.assigned)
    : isUpperSecondary
      ? (item?.upperSecondaryAssigned ?? item?.assigned)
      : item?.assigned;
  const usedPercent = displayedCapacity
    ? Math.min(100, Math.round(((displayedAssigned ?? 0) / displayedCapacity) * 100))
    : 0;
  const counterLabel = isLowerSecondary
    ? "iPad ที่เปิดให้ ม.1–ม.3"
    : isUpperSecondary
      ? "iPad สำหรับ ม.4–ม.6"
      : `iPad สำหรับ${audienceLabel}`;
  const detail = audience === "student" && item
    ? isLowerSecondary
      ? `ลงทะเบียนรับแล้ว ${(item.lowerSecondaryAssigned ?? 0).toLocaleString("th-TH")} จากโควตา ${(item.lowerSecondaryCapacity ?? 0).toLocaleString("th-TH")} เครื่อง`
      : isUpperSecondary
        ? `ลงทะเบียนรับแล้ว ${(item.upperSecondaryAssigned ?? 0).toLocaleString("th-TH")} จากโควตาตามรายชื่อ ${(item.upperSecondaryTotal ?? 0).toLocaleString("th-TH")} เครื่อง`
        : `ม.ต้นเหลือ ${(item.lowerSecondaryRemaining ?? item.lowerSecondaryAvailable ?? 0).toLocaleString("th-TH")} เครื่อง · ม.ปลายเหลือ ${(item.upperSecondaryRemaining ?? item.upperSecondaryReserved ?? 0).toLocaleString("th-TH")} เครื่อง`
    : item
      ? `ลงทะเบียนรับแล้ว ${item.assigned.toLocaleString("th-TH")} เครื่อง จากทั้งหมด ${item.capacity.toLocaleString("th-TH")} เครื่อง`
      : "";

  return (
    <aside
      className={`public-ipad-counter ${audience}`}
      aria-label={`จำนวน iPad คงเหลือสำหรับ${audienceLabel}`}
      aria-live="polite"
    >
      <span className="public-ipad-counter-icon">
        <FontAwesomeIcon icon={failed ? faCircleExclamation : faTabletScreenButton} />
      </span>
      <div className="public-ipad-counter-copy">
        <small>{counterLabel}</small>
        <b>{failed ? "ตรวจสอบจำนวนไม่ได้" : "จำนวนเครื่องที่ยังว่าง"}</b>
        {!failed && item && <span>{detail}</span>}
      </div>
      <div className="public-ipad-counter-number">
        {failed ? (
          <span>กรุณาลองใหม่</span>
        ) : item ? (
          <>
            <strong>{(displayedRemaining ?? 0).toLocaleString("th-TH")}</strong>
            <span>เครื่อง</span>
          </>
        ) : (
          <span className="counter-loading">กำลังโหลด...</span>
        )}
      </div>
      {!failed && (
        <div className="public-ipad-counter-meter" aria-hidden="true">
          <i style={{ width: `${usedPercent}%` }} />
        </div>
      )}
    </aside>
  );
}
