import { requireAdminApi } from "@/lib/auth/admin";
import { audit } from "@/lib/audit";
import { getEnv } from "@/lib/cloudflare/env";
import { ensureDatabase, id, now } from "@/lib/db/runtime";
import { apiError, json } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security/request";

type SupportedFile = { mimeType: string; extension: string; label: string };

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function detectFile(bytes: Uint8Array): SupportedFile | null {
  if (new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
    return { mimeType: "application/pdf", extension: "pdf", label: "PDF" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { mimeType: "image/jpeg", extension: "jpg", label: "JPG" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mimeType: "image/png", extension: "png", label: "PNG" };
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return { mimeType: "image/webp", extension: "webp", label: "WebP" };
  const gifHeader = new TextDecoder().decode(bytes.slice(0, 6));
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a")
    return { mimeType: "image/gif", extension: "gif", label: "GIF" };
  return null;
}

function decodeUploadHeader(request: Request, name: string, maxLength: number) {
  const encoded = request.headers.get(name) ?? "";
  if (!encoded) return "";
  try {
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes).trim().slice(0, maxLength);
  } catch {
    return "";
  }
}

function decodeSignature(value: string | null) {
  if (!value || !/^[0-9a-f]{10,64}$/i.test(value) || value.length % 2 !== 0)
    return new Uint8Array();
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

/**
 * Handles publicity uploads directly at the Worker boundary. The file is sent
 * as the raw request body and streamed to R2 so it is not buffered by Vinext's
 * generic 1 MB API adapter. Both the Worker entry and App Router fallback call
 * this same secured implementation.
 */
export async function uploadPublicityDocument(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdminApi(request);
    const title = decodeUploadHeader(request, "x-upload-title", 200);
    const description = decodeUploadHeader(
      request,
      "x-upload-description",
      1000,
    );
    const originalFilename = decodeUploadHeader(
      request,
      "x-upload-filename",
      255,
    ).replace(/[\\/\0]/g, "_");
    const requestedGroupId = decodeUploadHeader(
      request,
      "x-publication-group-id",
      100,
    );
    if (!request.body || !title || !originalFilename)
      return json(
        { error: "กรุณาเลือกไฟล์และระบุชื่อประชาสัมพันธ์" },
        400,
      );
    const detected = detectFile(
      decodeSignature(request.headers.get("x-upload-signature")),
    );
    if (!detected)
      return json(
        { error: "รองรับเฉพาะ PDF, JPG, PNG, WebP และ GIF" },
        400,
      );

    const db = await ensureDatabase();
    const documentId = id();
    const existingGroup = requestedGroupId
      ? await db
          .prepare(
            "SELECT publication_group_id, sort_order, MAX(attachment_order) AS last_attachment_order FROM project_documents WHERE publication_group_id = ? GROUP BY publication_group_id, sort_order",
          )
          .bind(requestedGroupId)
          .first<{
            publication_group_id: string;
            sort_order: number;
            last_attachment_order: number;
          }>()
      : null;
    if (requestedGroupId && !existingGroup)
      return json(
        { error: "ไม่พบชุดประชาสัมพันธ์ กรุณาเลือกไฟล์ใหม่อีกครั้ง" },
        409,
      );
    const publicationGroupId = existingGroup?.publication_group_id ?? documentId;
    const attachmentOrder = existingGroup
      ? Number(existingGroup.last_attachment_order ?? 0) + 1
      : 0;
    const nextSortOrder = existingGroup
      ? Number(existingGroup.sort_order)
      : Number(
          (
            await db
              .prepare(
                "SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_sort_order FROM project_documents",
              )
              .first<{ next_sort_order: number }>()
          )?.next_sort_order ?? 10,
        );
    const objectKey = `project-documents/${documentId}.${detected.extension}`;
    const stamp = now();
    const storedObject = await getEnv().FILES.put(objectKey, request.body, {
      httpMetadata: { contentType: detected.mimeType },
    });
    try {
      await db
        .prepare(
          "INSERT INTO project_documents (id,title,description,original_filename,object_key,mime_type,size_bytes,sort_order,is_active,uploaded_by,created_at,updated_at,publication_group_id,attachment_order) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?)",
        )
        .bind(
          documentId,
          title,
          description || null,
          originalFilename,
          objectKey,
          detected.mimeType,
          storedObject.size,
          nextSortOrder,
          admin.id,
          stamp,
          stamp,
          publicationGroupId,
          attachmentOrder,
        )
        .run();
    } catch (error) {
      await getEnv().FILES.delete(objectKey);
      throw error;
    }
    await audit(
      db,
      admin.id,
      "UPLOAD_PUBLICATION",
      "project_document",
      documentId,
      `อัปโหลดประชาสัมพันธ์ ${title} (${detected.label})`,
    );
    return json({
      success: true,
      id: documentId,
      groupId: publicationGroupId,
      mimeType: detected.mimeType,
    });
  } catch (error) {
    return apiError(error);
  }
}
