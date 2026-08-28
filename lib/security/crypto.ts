import { getEnv } from "@/lib/cloudflare/env";

const encoder = new TextEncoder();
// Cloudflare Workers cap each WebCrypto PBKDF2 operation at 100,000
// iterations. Chain three independently salted stages so every new password
// hash still costs 300,000 iterations without exceeding that per-call limit.
const PASSWORD_HASH_ITERATIONS = 100_000;
const PASSWORD_HASH_ROUNDS = 3;
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function base64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function source(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

function saltForRound(salt: Uint8Array, round: number): Uint8Array {
  const result = new Uint8Array(salt.byteLength + 4);
  result.set(salt);
  new DataView(result.buffer).setUint32(salt.byteLength, round, false);
  return result;
}

async function derivePbkdf2(
  materialBytes: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    source(materialBytes),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: source(salt),
        iterations,
        hash: "SHA-256",
      },
      material,
      256,
    ),
  );
}

export async function sha256(value: string): Promise<string> {
  return base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
export async function hashSecret(value: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  let derived = encoder.encode(value);
  for (let round = 0; round < PASSWORD_HASH_ROUNDS; round += 1) {
    derived = await derivePbkdf2(
      derived,
      saltForRound(salt, round),
      PASSWORD_HASH_ITERATIONS,
    );
  }
  return `pbkdf2-chain$${PASSWORD_HASH_ROUNDS}$${PASSWORD_HASH_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}
export async function verifySecret(
  value: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split("$");
  let actual: Uint8Array;
  let expectedRaw: string;

  if (parts[0] === "pbkdf2-chain") {
    const [, roundsRaw, iterationsRaw, saltRaw, stored] = parts;
    const rounds = Number(roundsRaw);
    const iterations = Number(iterationsRaw);
    if (
      !saltRaw ||
      !stored ||
      !Number.isInteger(rounds) ||
      rounds < 1 ||
      rounds > 10 ||
      !Number.isInteger(iterations) ||
      iterations < 100_000 ||
      iterations > PASSWORD_HASH_ITERATIONS
    ) return false;
    const salt = fromBase64(saltRaw);
    actual = encoder.encode(value);
    for (let round = 0; round < rounds; round += 1) {
      actual = await derivePbkdf2(
        actual,
        saltForRound(salt, round),
        iterations,
      );
    }
    expectedRaw = stored;
  } else {
    const [algorithm, iterationsRaw, saltRaw, stored] = parts;
    const iterations = Number(iterationsRaw);
    if (
      algorithm !== "pbkdf2" ||
      !saltRaw ||
      !stored ||
      !Number.isInteger(iterations) ||
      iterations < 1 ||
      iterations > PASSWORD_HASH_ITERATIONS
    ) return false;
    actual = await derivePbkdf2(
      encoder.encode(value),
      fromBase64(saltRaw),
      iterations,
    );
    expectedRaw = stored;
  }

  const expected = fromBase64(expectedRaw);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index++)
    mismatch |= actual[index] ^ expected[index];
  return mismatch === 0;
}
async function encryptionKey(): Promise<CryptoKey> {
  const configured = getEnv().PII_ENCRYPTION_KEY;
  if (!configured) throw new Error("PII_ENCRYPTION_KEY ยังไม่ได้ตั้งค่า");
  let raw: Uint8Array;
  try {
    raw = fromBase64(configured);
  } catch {
    raw = encoder.encode(configured);
  }
  if (raw.byteLength !== 32)
    raw = new Uint8Array(await crypto.subtle.digest("SHA-256", source(raw)));
  return crypto.subtle.importKey("raw", source(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encryptJson(
  value: unknown,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: source(iv) },
    await encryptionKey(),
    encoder.encode(JSON.stringify(value)),
  );
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}
export async function decryptJson<T>(
  ciphertext: string,
  iv: string,
): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: source(fromBase64(iv)) },
    await encryptionKey(),
    source(fromBase64(ciphertext)),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
export async function signToken(
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  const secret = getEnv().SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET ยังไม่ได้ตั้งค่า");
  const body = base64Url(
    encoder.encode(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = base64Url(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body))),
  );
  return `${body}.${signature}`;
}
export async function verifyToken<T extends Record<string, unknown>>(
  token: string,
): Promise<T | null> {
  try {
    const [body, signature] = token.split("."),
      secret = getEnv().SESSION_SECRET;
    if (!body || !signature || !secret) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        key,
        source(fromBase64(signature)),
        encoder.encode(body),
      ))
    )
      return null;
    const decoded = JSON.parse(
      new TextDecoder().decode(fromBase64(body)),
    ) as T & { exp: number };
    return decoded.exp > Math.floor(Date.now() / 1000) ? decoded : null;
  } catch {
    return null;
  }
}
