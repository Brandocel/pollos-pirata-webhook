import crypto from "crypto";

interface OAuthStatePayload {
  iat: number;
  exp: number;
  appRedirectUri?: string;
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

function sign(input: string): string {
  return base64UrlEncode(
    crypto.createHmac("sha256", SESSION_SECRET as string).update(input).digest()
  );
}

export function createOAuthState(appRedirectUri?: string): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: OAuthStatePayload = {
    iat: now,
    exp: now + 10 * 60,
    appRedirectUri: appRedirectUri || undefined
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

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    )
  ) {
    return null;
  }

  try {
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