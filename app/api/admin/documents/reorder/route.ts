import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { ensureDatabase, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

const publicationSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "รายการลำดับซ้ำกัน",
    }),
});

const attachmentSchema = z.object({
  groupId: z.string().trim().min(1).max(100),
  orderedAttachmentIds: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "รายการลำดับไฟล์ซ้ำกัน",
    }),
});

const schema = z.union([publicationSchema, attachmentSchema]);

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request);
    const input = schema.parse(await request.json());
    const db = await ensureDatabase();
    if ("orderedAttachmentIds" in input) {
      const existing = await db
        .prepare(
          "SELECT id FROM project_documents WHERE COALESCE(publication_group_id, id) = ?",
        )
        .bind(input.groupId)
        .all<{ id: string }>();
      const existingIds = new Set((existing.results ?? []).map((row) => row.id));
      if (
        input.orderedAttachmentIds.length > existingIds.size ||
        input.orderedAttachmentIds.some((documentId) => !existingIds.has(documentId))
      ) {
        return json(
          { error: "ไฟล์ประชาสัมพันธ์มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง" },
          409,
        );
      }
      const updatedAt = now();
      await db.batch(
        input.orderedAttachmentIds.map((documentId, index) =>
          db
            .prepare(
              "UPDATE project_documents SET attachment_order = ?, updated_at = ? WHERE id = ? AND COALESCE(publication_group_id, id) = ?",
            )
            .bind(index, updatedAt, documentId, input.groupId),
        ),
      );
      await audit(
        db,
        admin.id,
        "REORDER_PUBLICATION_ATTACHMENTS",
        "project_document",
        input.groupId,
        "เปลี่ยนลำดับรูปและไฟล์ในประชาสัมพันธ์",
        undefined,
        { orderedAttachmentIds: input.orderedAttachmentIds },
      );
      return json({ success: true });
    }
    const { orderedIds } = input;
    const existing = await db
      .prepare(
        "SELECT DISTINCT COALESCE(publication_group_id, id) AS group_id FROM project_documents",
      )
      .all<{ group_id: string }>();
    const existingIds = new Set(
      (existing.results ?? []).map((row) => row.group_id),
    );

    if (
      existingIds.size !== orderedIds.length ||
      orderedIds.some((documentId) => !existingIds.has(documentId))
    ) {
      return json(
        { error: "รายการประชาสัมพันธ์มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง" },
        409,
      );
    }

    const updatedAt = now();
    await db.batch(
      orderedIds.map((groupId, index) =>
        db
          .prepare(
            "UPDATE project_documents SET sort_order = ?, updated_at = ? WHERE COALESCE(publication_group_id, id) = ?",
          )
          .bind((index + 1) * 10, updatedAt, groupId),
      ),
    );
    await audit(
      db,
      admin.id,
      "REORDER_PUBLICATIONS",
      "project_document",
      null,
      "เปลี่ยนลำดับการแสดงผลประชาสัมพันธ์",
      undefined,
      { orderedIds },
    );
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
