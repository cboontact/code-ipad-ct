import {
  getDistricts,
  getSubdistricts,
  provinces,
} from "@/lib/data/thai-address";
import { apiError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const province = (url.searchParams.get("province") ?? "").trim();
    const district = (url.searchParams.get("district") ?? "").trim();
    const cacheHeaders = { "Cache-Control": "public, max-age=86400" };

    if (!province) return json({ provinces }, 200, cacheHeaders);
    if (!district)
      return json({ districts: getDistricts(province) }, 200, cacheHeaders);

    return json(
      { subdistricts: getSubdistricts(province, district) },
      200,
      cacheHeaders,
    );
  } catch (error) {
    return apiError(error);
  }
}
