import { signToken, verifyToken } from "@/lib/security/crypto";

export const STUDENT_PRINT_COOKIE = "student_awat_print";
const STUDENT_PRINT_TTL_SECONDS = 30 * 60;

type StudentPrintToken = {
  studentId: string;
  purpose: "student-awat-print";
};

function secureCookieAttribute(request: Request): string {
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const isHttps = forwardedProtocol
    ? forwardedProtocol === "https"
    : new URL(request.url).protocol === "https:";
  return isHttps ? "; Secure" : "";
}

export async function createStudentPrintCookie(
  studentId: string,
  request: Request,
): Promise<string> {
  const token = await signToken(
    { studentId, purpose: "student-awat-print" },
    STUDENT_PRINT_TTL_SECONDS,
  );
  return `${STUDENT_PRINT_COOKIE}=${encodeURIComponent(token)}; Path=/student/print; HttpOnly${secureCookieAttribute(request)}; SameSite=Strict; Max-Age=${STUDENT_PRINT_TTL_SECONDS}`;
}

export function clearStudentPrintCookie(request: Request): string {
  return `${STUDENT_PRINT_COOKIE}=; Path=/student/print; HttpOnly${secureCookieAttribute(request)}; SameSite=Strict; Max-Age=0`;
}

export async function studentIdFromPrintToken(
  token?: string,
): Promise<string | null> {
  if (!token) return null;
  const payload = await verifyToken<StudentPrintToken>(token);
  if (!payload || payload.purpose !== "student-awat-print" || !payload.studentId)
    return null;
  return payload.studentId;
}
