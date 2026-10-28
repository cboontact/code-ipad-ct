import { uploadTrainingSelfie } from "@/lib/training/selfie-upload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return uploadTrainingSelfie(request);
}
