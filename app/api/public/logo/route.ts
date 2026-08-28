import { getEnv } from "@/lib/cloudflare/env";
import { ensureDatabase, getSettings } from "@/lib/db/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase(),
      settings = await getSettings(db),
      objectKey = settings.logo_object_key;

    if (!objectKey)
      return Response.redirect(new URL("/logo.png", request.url), 307);

    const object = await getEnv().FILES.get(objectKey);
    if (!object)
      return Response.redirect(new URL("/logo.png", request.url), 307);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", "inline");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Unable to load custom logo", error);
    return Response.redirect(new URL("/logo.png", request.url), 307);
  }
}
