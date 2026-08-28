import { ZodError } from "zod";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function apiError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (error instanceof ZodError) return json({ error: "ข้อมูลไม่ถูกต้อง", fields: error.flatten().fieldErrors }, 400);
  if (message === "UNAUTHORIZED") return json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, 401);
  if (message === "FORBIDDEN") return json({ error: "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ" }, 403);
  if (message === "INVALID_ORIGIN") return json({ error: "คำขอไม่ปลอดภัย" }, 403);
  if (message === "RATE_LIMITED")
    return json(
      { error: "ดำเนินการบ่อยเกินไป กรุณารอสักครู่" },
      429,
      { "Retry-After": "60" },
    );
  if (message === "SURVEY_CLOSED") return json({ error: "ขณะนี้ปิดรับลงทะเบียนแล้ว" }, 403);
  if (message === "TEACHER_REGISTRATION_CLOSED") return json({ error: "ขณะนี้ปิดรับลงทะเบียนสำหรับครูและบุคลากรแล้ว" }, 403);
  if (message === "STUDENT_REGISTRATION_CLOSED") return json({ error: "ขณะนี้ปิดรับลงทะเบียนสำหรับนักเรียนแล้ว" }, 403);
  if (/D1_ERROR|overloaded|database is locked|too many requests|timed? ?out/i.test(message)) {
    console.error(error);
    return json(
      { error: "ขณะนี้มีผู้ใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองอีกครั้ง" },
      503,
      { "Retry-After": "2" },
    );
  }
  console.error(error);
  return json({ error: "ระบบไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง" }, 500);
}
