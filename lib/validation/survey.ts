import { z } from "zod";
import {
  academicRankOptions,
  positionOptions,
} from "@/lib/data/teacher-options";
import { guardianPrefixOptions } from "@/lib/data/student-options";
import { isNdlpEmail, isSchoolEmail } from "@/lib/validation/email-domains";
import {
  isValidStudentIdentityId,
  isValidThaiCitizenId,
  normalizeStudentIdentityId,
} from "@/lib/validation/student-identity";

export {
  isValidStudentIdentityId,
  isValidThaiCitizenId,
  normalizeStudentIdentityId,
} from "@/lib/validation/student-identity";

export const schoolEmailSchema = z.string().trim()
  .email("กรุณากรอกอีเมลโรงเรียนให้ถูกต้อง").max(180)
  .refine(isSchoolEmail, "อีเมลโรงเรียนต้องลงท้ายด้วย @chomthong.ac.th");
export const ndlpEmailSchema = z.string().trim()
  .email("กรุณากรอกอีเมล NDLP ให้ถูกต้อง").max(180)
  .refine(isNdlpEmail, "อีเมล NDLP ต้องลงท้ายด้วย @ndlp.go.th");

export const studentIdentityIdSchema = z.string()
  .trim()
  .transform(normalizeStudentIdentityId)
  .refine(
    isValidStudentIdentityId,
    "เลขประจำตัวไม่ถูกต้อง: คนไทยใช้เลข 13 หลัก, เด็กติด G ใช้ G ตามด้วยตัวเลข 12 หลัก หรือบุคคลไม่มีสัญชาติไทยใช้เลข 13 หลักที่ขึ้นต้นด้วย 0",
  );

export const piiSchema = z.object({
  citizenId: z.string().regex(/^\d{13}$/, "กรุณากรอกเลขประจำตัวประชาชน 13 หลัก").refine(isValidThaiCitizenId, "เลขประจำตัวประชาชนไม่ถูกต้อง"),
  houseNo: z.string().trim().min(1, "กรุณากรอกบ้านเลขที่").max(30), moo: z.string().trim().max(20).optional().default(""),
  soi: z.string().trim().max(100).optional().default(""), road: z.string().trim().max(100).optional().default(""), subdistrict: z.string().trim().min(1, "กรุณาเลือกตำบล").max(100),
  district: z.string().trim().min(1, "กรุณาเลือกอำเภอ").max(100), province: z.string().trim().min(1, "กรุณาเลือกจังหวัด").max(100),
  postalCode: z.string().regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"),
});
export const teacherProfileSchema = z.object({
  position: z.enum(positionOptions, {
    error: "กรุณาเลือกตำแหน่ง",
  }),
  academicRank: z.enum(academicRankOptions, {
    error: "กรุณาเลือกวิทยฐานะ",
  }),
  email: schoolEmailSchema,
  ndlpEmail: ndlpEmailSchema,
  phone: z.string().regex(/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/, "กรุณากรอกหมายเลขโทรศัพท์ประเทศไทยให้ถูกต้อง"),
});
export const surveySubmitSchema = z.object({
  teacherId: z.string().uuid(), verificationToken: z.string().min(20), decision: z.enum(["ACCEPT", "DECLINE"]),
  privacyAcknowledged: z.boolean(), profile: teacherProfileSchema, pii: piiSchema.optional(),
}).superRefine((value, context) => {
  if (value.decision === "ACCEPT" && !value.pii) context.addIssue({ code: "custom", message: "กรุณากรอกข้อมูลส่วนบุคคลให้ครบ", path: ["pii"] });
  if (value.decision === "ACCEPT" && !value.privacyAcknowledged) context.addIssue({ code: "custom", message: "กรุณารับทราบการใช้ข้อมูลส่วนบุคคล", path: ["privacyAcknowledged"] });
});
export type PersonalData = z.infer<typeof piiSchema>;
export type TeacherProfile = z.infer<typeof teacherProfileSchema>;

export function hasGuardianPrefixInName(value: string) {
  const normalized = value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return /^(?:เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|น\s*\.?\s*ส\s*\.?)/.test(normalized);
}

function normalizeComparedPersonName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^(?:เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง)\s*/, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("th-TH");
}

export function isGuardianNameSameAsStudent(guardianName: string, studentName: string) {
  const guardian = normalizeComparedPersonName(guardianName);
  const student = normalizeComparedPersonName(studentName);
  return Boolean(guardian && student && guardian === student);
}

export function parseGuardianFullName(value: string): { prefix: typeof guardianPrefixOptions[number]; name: string } | null {
  const normalized = value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/\s+/g, " ");
  const match = normalized.match(/^(นางสาว|นาย|นาง(?!สาว))\s*(.+)$/);
  const name = match?.[2]?.trim() ?? "";
  if (!match || name.split(/\s+/).filter(Boolean).length < 2 || hasGuardianPrefixInName(name)) return null;
  return { prefix: match[1] as typeof guardianPrefixOptions[number], name };
}

export const studentPiiSchema = piiSchema.extend({
  citizenId: studentIdentityIdSchema,
  guardianPrefix: z.enum(guardianPrefixOptions, {
    error: "กรุณาเลือกคำนำหน้าผู้ปกครอง",
  }),
  guardianName: z.string().trim().min(1, "กรุณากรอกชื่อผู้ปกครอง").max(200)
    .refine(
      (value) => !hasGuardianPrefixInName(value),
      "ช่องชื่อ-นามสกุลผู้ปกครองไม่ต้องใส่ นาย นาง นางสาว หรือ น.ส.",
    ),
  guardianPhone: z.string().regex(
    /^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/,
    "กรุณากรอกหมายเลขโทรศัพท์ผู้ปกครองให้ถูกต้อง",
  ),
});

export const studentSubmitSchema = z.object({
  studentId: z.string().uuid(),
  verificationToken: z.string().min(20),
  decision: z.enum(["ACCEPT", "DECLINE"]),
  privacyAcknowledged: z.boolean(),
  phone: z.string().regex(
    /^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/,
    "กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง",
  ),
  email: z.union([
    z.literal(""),
    schoolEmailSchema,
  ]),
  ndlpEmail: z.union([
    z.literal(""),
    ndlpEmailSchema,
  ]),
  pii: studentPiiSchema.optional(),
}).superRefine((value, context) => {
  if (value.decision === "ACCEPT" && !value.pii)
    context.addIssue({ code: "custom", message: "กรุณากรอกข้อมูลสำหรับเอกสารให้ครบ", path: ["pii"] });
  if (value.decision === "ACCEPT" && !value.privacyAcknowledged)
    context.addIssue({ code: "custom", message: "กรุณารับทราบการใช้ข้อมูลส่วนบุคคล", path: ["privacyAcknowledged"] });
  if (value.decision === "ACCEPT" && !value.email)
    context.addIssue({ code: "custom", message: "กรุณากรอกอีเมลโรงเรียน", path: ["email"] });
  if (value.decision === "ACCEPT" && !value.ndlpEmail)
    context.addIssue({ code: "custom", message: "กรุณากรอกอีเมล NDLP", path: ["ndlpEmail"] });
});

export type StudentPersonalData = z.infer<typeof studentPiiSchema>;
