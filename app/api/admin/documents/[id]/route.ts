import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { getEnv } from "@/lib/cloudflare/env";
import { ensureDatabase, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

async function findGroup(db: D1Database, documentId: string) {
  return db
    .prepare(
      "SELECT COALESCE(publication_group_id, id) AS group_id, title FROM project_documents WHERE id = ?",
    )
    .bind(documentId)
    .first<{ group_id: string; title: string }>();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request);
    const input = schema.parse(await request.json());
    const { id } = await params;
    const db = await ensureDatabase();
    const group = await findGroup(db, id);
    if (!group) return json({ error: "ไม่พบรายการประชาสัมพันธ์" }, 404);
    await db
      .prepare(
        "UPDATE project_documents SET title = ?, description = ?, sort_order = ?, is_active = ?, updated_at = ? WHERE COALESCE(publication_group_id, id) = ?",
      )
      .bind(
        input.title,
        input.description?.trim() || null,
        input.sortOrder,
        input.isActive ? 1 : 0,
        now(),
        group.group_id,
      )
      .run();
    await audit(
      db,
      admin.id,
      "EDIT_PUBLICATION",
      "project_document",
      group.group_id,
      `แก้ไขประชาสัมพันธ์ ${input.title}`,
    );
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request);
    const { id } = await params;
    const db = await ensureDatabase();
    const group = await findGroup(db, id);
    if (!group) return json({ error: "ไม่พบรายการประชาสัมพันธ์" }, 404);
    const deleteAttachment = new URL(request.url).searchParams.get("attachment") === "1";
    if (deleteAttachment) {
      const document = await db
        .prepare(
          "SELECT id, object_key, original_filename FROM project_documents WHERE id = ? AND COALESCE(publication_group_id, id) = ?",
        )
        .bind(id, group.group_id)
        .first<{ id: string; object_key: string; original_filename: string }>();
      if (!document) return json({ error: "ไม่พบไฟล์ประชาสัมพันธ์" }, 404);
      const countRow = await db
        .prepare(
          "SELECT COUNT(*) AS total FROM project_documents WHERE COALESCE(publication_group_id, id) = ?",
        )
        .bind(group.group_id)
        .first<{ total: number }>();
      if (Number(countRow?.total ?? 0) <= 1) {
        return json({ error: "รายการประชาสัมพันธ์ต้องเหลือไฟล์อย่างน้อย 1 ไฟล์" }, 409);
      }
      await getEnv().FILES.delete(document.object_key);
      await db.prepare("DELETE FROM project_documents WHERE id = ?").bind(id).run();
      const remaining = await db
        .prepare(
          "SELECT id FROM project_documents WHERE COALESCE(publication_group_id, id) = ? ORDER BY attachment_order ASC, created_at ASC",
        )
        .bind(group.group_id)
        .all<{ id: string }>();
      if (remaining.results?.length) {
        const updatedAt = now();
        await db.batch(
          remaining.results.map((row, index) =>
            db
              .prepare(
                "UPDATE project_documents SET attachment_order = ?, updated_at = ? WHERE id = ?",
              )
              .bind(index, updatedAt, row.id),
          ),
        );
      }
      await audit(
        db,
        admin.id,
        "DELETE_PUBLICATION_ATTACHMENT",
        "project_document",
        id,
        `ลบไฟล์ ${document.original_filename} ออกจากประชาสัมพันธ์ ${group.title}`,
      );
      return json({ success: true });
    }
    const documents = await db
      .prepare(
        "SELECT object_key FROM project_documents WHERE COALESCE(publication_group_id, id) = ?",
      )
      .bind(group.group_id)
      .all<{ object_key: string }>();
    await Promise.all(
      (documents.results ?? []).map((document) =>
        getEnv().FILES.delete(document.object_key),
      ),
    );
    await db
      .prepare(
        "DELETE FROM project_documents WHERE COALESCE(publication_group_id, id) = ?",
      )
      .bind(group.group_id)
      .run();
    await audit(
      db,
      admin.id,
      "DELETE_PUBLICATION",
      "project_document",
      group.group_id,
      `ลบประชาสัมพันธ์ ${group.title} (${documents.results?.length ?? 0} ไฟล์)`,
    );
    return json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
