import { ensureDatabase } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

type DocumentRow = {
  id: string;
  publication_group_id: string | null;
  title: string;
  description: string | null;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  attachment_order: number;
  created_at: string;
};

type PublicityGroup = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  sort_order: number;
  files: Array<{
    id: string;
    mime_type: string;
    size_bytes: number;
    attachment_order: number;
    created_at: string;
  }>;
};

export async function GET() {
  try {
    const db = await ensureDatabase();
    const result = await db
      .prepare(
        "SELECT id, publication_group_id, title, description, mime_type, size_bytes, sort_order, attachment_order, created_at FROM project_documents WHERE is_active = 1 ORDER BY sort_order, created_at DESC, attachment_order",
      )
      .all<DocumentRow>();
    const groups = new Map<string, PublicityGroup>();
    for (const row of result.results ?? []) {
      const groupId = row.publication_group_id || row.id;
      const current = groups.get(groupId);
      const file = {
        id: row.id,
        mime_type: row.mime_type,
        size_bytes: Number(row.size_bytes),
        attachment_order: Number(row.attachment_order ?? 0),
        created_at: row.created_at,
      };
      if (current) current.files.push(file);
      else
        groups.set(groupId, {
          id: groupId,
          title: row.title,
          description: row.description,
          created_at: row.created_at,
          sort_order: Number(row.sort_order),
          files: [file],
        });
    }
    const documents = Array.from(groups.values())
      .map((group) => ({
        ...group,
        files: group.files.sort(
          (left, right) => left.attachment_order - right.attachment_order,
        ),
      }))
      .sort(
        (left, right) =>
          left.sort_order - right.sort_order ||
          right.created_at.localeCompare(left.created_at),
      );
    return json({ documents });
  } catch (error) {
    return apiError(error);
  }
}
