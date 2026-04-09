import crypto from "crypto";

interface OAuthStatePayload {
  iat: number;
  exp: number;
}

const SESSION_SECRET = process.env.SESSION_SECRET as string;

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
  const padding = (4 - (normalized.length % 4)) % 4;

  return Buffer.from(normalized + "=".repeat(padding), "base64");
}

function sign(input: string): string {
  return base64UrlEncode(
    crypto.createHmac("sha256", SESSION_SECRET!).update(input).digest()
  );
}

export function createOAuthState(): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: OAuthStatePayload = {
    iat: now,
    exp: now + 10 * 60
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);

  try {
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expectedSignature, "utf8");

    if (a.length !== b.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8")
    ) as OAuthStatePayload;

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}