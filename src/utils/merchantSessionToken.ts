import crypto from "crypto";

export interface MerchantSessionPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET debe existir y tener al menos 32 caracteres");
}

function base64UrlEncode(value: Buffer | string): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (normalized.length % 4 || 4);
  return Buffer.from(normalized + "=".repeat(padding % 4), "base64");
}

function getKey(): Buffer {
  return crypto.createHash("sha256").update(SESSION_SECRET as string).digest();
}

export function createMerchantSessionToken(payload: MerchantSessionPayload): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return base64UrlEncode(Buffer.concat([iv, tag, encrypted]));
}

export function readMerchantSessionToken(token: string): MerchantSessionPayload | null {
  try {
    const raw = base64UrlDecode(token);

    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);

    const key = getKey();

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    const payload = JSON.parse(decrypted.toString("utf8")) as MerchantSessionPayload;

    if (Date.now() >= payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}