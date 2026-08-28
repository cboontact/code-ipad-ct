import { uploadPublicityDocument } from "@/lib/documents/upload";

export async function POST(request: Request) {
  return uploadPublicityDocument(request);
}
