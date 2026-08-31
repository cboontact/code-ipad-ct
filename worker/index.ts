/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { uploadPublicityDocument } from "../lib/documents/upload";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  SESSION_SECRET: string;
  PII_ENCRYPTION_KEY: string;
  ADMIN_INITIAL_USERNAME?: string;
  ADMIN_INITIAL_PASSWORD?: string;
  ADMIN_INITIAL_DISPLAY_NAME?: string;
  IMAGES: ImagesBinding;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface BufferedResponse {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  headers: [string, string][];
}

const publicCacheFills = new Map<string, Promise<BufferedResponse>>();

function publicCacheTtl(pathname: string): number | null {
  if (pathname === "/api/public/addresses") return 86_400;
  if (pathname === "/api/public/bootstrap") return 10;
  if (pathname === "/api/public/inventory") return 3;
  if (pathname === "/api/public/documents") return 30;
  if (pathname === "/api/public/logo") return 300;
  if (/^\/api\/public\/areas\/[^/]+\/teachers$/.test(pathname)) return 10;
  if (/^\/api\/public\/documents\/[^/]+\/file$/.test(pathname)) return 300;
  if (/^\/api\/public\/documents\/[^/]+\/preview$/.test(pathname)) return 86_400;
  return null;
}

async function fetchWithPublicCache(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  ttl: number,
): Promise<Response> {
  const cacheKey = new Request(request.url, { method: "GET" });
  let cached: Response | undefined;
  try {
    cached = await caches.default.match(cacheKey);
  } catch {
    // Sites deployments do not expose the Workers default Cache API. The
    // response headers and in-flight request coalescing below still protect D1
    // from bursts, so cache availability must never make the API fail.
  }
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("X-Public-Cache", "HIT");
    return response;
  }

  const cacheId = cacheKey.url;
  let fill = publicCacheFills.get(cacheId);
  const joinedExistingFill = Boolean(fill);
  if (!fill) {
    fill = (async () => {
      const origin = await handler.fetch(request, env, ctx);
      const headers = new Headers(origin.headers);
      const cacheable = origin.ok && !headers.has("Set-Cookie");
      if (cacheable) {
        headers.set(
          "Cache-Control",
          `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${Math.max(10, ttl * 2)}`,
        );
        headers.set("X-Public-Cache", "MISS");
      }
      const buffered: BufferedResponse = {
        body: await origin.arrayBuffer(),
        status: origin.status,
        statusText: origin.statusText,
        headers: [...headers.entries()],
      };
      if (cacheable) {
        const cacheWrite = caches.default
          .put(cacheKey, new Response(buffered.body.slice(0), buffered))
          .catch(() => undefined);
        ctx.waitUntil(cacheWrite);
      }
      return buffered;
    })();
    publicCacheFills.set(cacheId, fill);
  }

  try {
    const buffered = await fill;
    const response = new Response(buffered.body.slice(0), buffered);
    if (joinedExistingFill && response.ok)
      response.headers.set("X-Public-Cache", "COALESCED");
    return response;
  } finally {
    if (!joinedExistingFill) publicCacheFills.delete(cacheId);
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Stream publicity files straight to R2 before Vinext's generic API
    // adapter, whose fixed request buffer is unsuitable for file uploads.
    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/documents"
    )
      return uploadPublicityDocument(request);

    const cacheTtl =
      request.method === "GET" && !request.headers.has("Range")
        ? publicCacheTtl(url.pathname)
        : null;
    if (cacheTtl !== null)
      return fetchWithPublicCache(request, env, ctx, cacheTtl);

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
