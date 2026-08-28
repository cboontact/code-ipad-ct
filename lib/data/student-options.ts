export const studentGradeOptions = [
  "มัธยมศึกษาปีที่ 1",
  "มัธยมศึกษาปีที่ 2",
  "มัธยมศึกษาปีที่ 3",
  "มัธยมศึกษาปีที่ 4",
  "มัธยมศึกษาปีที่ 5",
  "มัธยมศึกษาปีที่ 6",
] as const;

export const studentRoomOptions = Array.from(
  { length: 13 },
  (_, index) => String(index + 1),
);

export const guardianPrefixOptions = ["นาย", "นาง", "นางสาว"] as const;

export function normalizeStudentGrade(value: unknown) {
  const text = value == null ? "" : String(value).trim();
  const match = text.match(/(?:ม\.?\s*|มัธยมศึกษาปีที่\s*)?([1-6])$/);
  return match ? `มัธยมศึกษาปีที่ ${match[1]}` : text;
}

export function normalizeStudentRoom(value: unknown) {
  const text = value == null ? "" : String(value).trim();
  const match = text.match(/^(?:ห้อง\s*)?(\d{1,2})$/);
  if (!match) return text;
  const room = String(Number(match[1]));
  return studentRoomOptions.includes(room) ? room : text;
}

export function studentGradeNumber(value: unknown) {
  const normalized = normalizeStudentGrade(value);
  return normalized.match(/([1-6])$/)?.[1] ?? normalized;
}
