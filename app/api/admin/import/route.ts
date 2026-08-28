import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase, generateTeacherCode, id, now } from "@/lib/db/runtime";
import { assertSameOrigin } from "@/lib/security/request";
import { apiError, json } from "@/lib/http";
import { positionOptions } from "@/lib/data/teacher-options";
import { ndlpEmailSchema, schoolEmailSchema } from "@/lib/validation/survey";

const rowSchema = z.object({
  prefix: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  learning_area: z.string().min(1),
  position: z
    .union([z.enum(positionOptions), z.literal("")])
    .optional()
    .default(""),
  academic_rank: z.string().optional().default(""),
  email: z.union([z.literal(""), schoolEmailSchema]).optional().default(""),
  ndlp_email: z.union([z.literal(""), ndlpEmailSchema]).optional().default(""),
  phone: z.string().regex(/^0(?:6|8|9)\d{8}$|^0(?:2|3|4|5|7)\d{7}$/).optional().or(z.literal("")),
});
const schema = z.object({
  rows: z.array(rowSchema).min(1).max(3000),
  createMissingAreas: z.boolean().default(false),
});
const codeFromName = (name: string) =>
  `AREA-${name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9ก-๙]+/g, "-")
    .slice(0, 30)}-${crypto.randomUUID().slice(0, 4)}`;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request),
      input = schema.parse(await request.json()),
      db = await ensureDatabase(),
      stamp = now();
    const existingAreas = await db
        .prepare("SELECT id,name FROM learning_areas")
        .all<{ id: string; name: string }>(),
      areaMap = new Map(
        (existingAreas.results ?? []).map(
          (row: { id: string; name: string }) => [row.name.trim(), row.id],
        ),
      );
    const missingAreas = [
      ...new Set(
        input.rows
          .map((row) => row.learning_area.trim())
          .filter((name) => !areaMap.has(name)),
      ),
    ];
    if (missingAreas.length && !input.createMissingAreas)
      return json(
        {
          needsConfirmation: true,
          missingAreas,
          error: "พบกลุ่มสาระที่ยังไม่มีในระบบ",
        },
        409,
      );
    for (const name of missingAreas) {
      const areaId = id();
      await db
        .prepare(
          "INSERT INTO learning_areas (id,code,name,icon,sort_order,is_active,created_at,updated_at) VALUES (?,?,?,?,999,1,?,?)",
        )
        .bind(areaId, codeFromName(name), name, "book-open", stamp, stamp)
        .run();
      areaMap.set(name, areaId);
    }
    const errors: Array<{ row: number; message: string }> = [];
    let imported = 0,
      updated = 0;
    for (let index = 0; index < input.rows.length; index++) {
      const row = input.rows[index],
        areaId = areaMap.get(row.learning_area.trim());
      if (!areaId) {
        errors.push({ row: index + 2, message: "ไม่พบกลุ่มสาระ" });
        continue;
      }
      const duplicate = await db
        .prepare("SELECT id FROM teachers WHERE prefix=? AND first_name=? AND last_name=? AND learning_area_id=?")
        .bind(
          row.prefix.trim(),
          row.first_name.trim(),
          row.last_name.trim(),
          areaId,
        )
        .first<{ id: string }>();
      if (duplicate) {
        await db
          .prepare(
            "UPDATE teachers SET prefix=?,first_name=?,last_name=?,learning_area_id=?,position=?,academic_rank=?,email=?,ndlp_email=?,phone=?,is_active=1,updated_at=? WHERE id=?",
          )
          .bind(
            row.prefix.trim(),
            row.first_name.trim(),
            row.last_name.trim(),
            areaId,
            row.position.trim() || null,
            row.academic_rank.trim() || null,
            row.email.trim() || null,
            row.ndlp_email.trim() || null,
            row.phone.trim() || null,
            stamp,
            duplicate.id,
          )
          .run();
        updated++;
      } else {
        await db
          .prepare(
            "INSERT INTO teachers (id,teacher_code,prefix,first_name,last_name,learning_area_id,position,academic_rank,email,ndlp_email,phone,is_active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)",
          )
          .bind(
            id(),
            generateTeacherCode(),
            row.prefix.trim(),
            row.first_name.trim(),
            row.last_name.trim(),
            areaId,
            row.position.trim() || null,
            row.academic_rank.trim() || null,
            row.email.trim() || null,
            row.ndlp_email.trim() || null,
            row.phone.trim() || null,
            stamp,
            stamp,
          )
          .run();
        imported++;
      }
    }
    await audit(
      db,
      admin.id,
      "IMPORT_TEACHERS",
      "teacher",
      null,
      `นำเข้าครู ${imported} ราย อัปเดต ${updated} ราย`,
      undefined,
      { imported, updated, missingAreas },
    );
    return json({
      success: true,
      imported,
      updated,
      errors,
      createdAreas: missingAreas,
    });
  } catch (error) {
    return apiError(error);
  }
}
