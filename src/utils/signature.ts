import * as crypto from "crypto";

export function generateUberSignature(
  rawBody: Buffer,
  clientSecret: string
): string {
  return crypto
    .createHmac("sha256", clientSecret)
    .update(rawBody)
    .digest("hex")
    .toLowerCase();
}

export function verifyUberSignature(params: {
  rawBody: Buffer;
  clientSecret: string;
  signatureHeader?: string | string[];
}): boolean {
  const { rawBody, clientSecret, signatureHeader } = params;

  if (!signatureHeader || Array.isArray(signatureHeader)) {
    return false;
  }

  const receivedSignature = signatureHeader.trim().toLowerCase();
  const expectedSignature = generateUberSignature(rawBody, clientSecret);

  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}