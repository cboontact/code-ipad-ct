export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    if (!response.ok) {
      const error =
        response.status === 413
          ? "ขนาดไฟล์เกินข้อจำกัดของระบบโฮสต์ กรุณาลองลดขนาดไฟล์"
          : text.trim() || "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง";
      return { error } as T;
    }

    throw new Error("เซิร์ฟเวอร์ตอบกลับข้อมูลไม่ถูกต้อง");
  }
}
