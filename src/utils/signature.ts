import chalk from "chalk";
import crypto from "crypto";

interface VerifyUberSignatureParams {
  rawBody: Buffer;
  clientSecret: string;
  signatureHeader?: string;
}

/**
 * Verifica la firma HMAC-SHA256 enviada por Uber en el header X-Uber-Signature.
 *
 * Uber firma el raw body del webhook. Por eso el endpoint debe recibir express.raw()
 * antes de express.json().
 */
export function verifyUberSignature({
  rawBody,
  clientSecret,
  signatureHeader
}: VerifyUberSignatureParams): boolean {
  if (!signatureHeader || !rawBody || rawBody.length === 0) {
    console.warn(chalk.yellow("Firma o body vacío en webhook de Uber"));
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac("sha256", clientSecret)
      .update(rawBody)
      .digest("hex")
      .toLowerCase();

    const receivedSignature = signatureHeader.toLowerCase();

    if (computedSignature.length !== receivedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, "utf8"),
      Buffer.from(receivedSignature, "utf8")
    );
  } catch (error) {
    console.error(chalk.red("Error al verificar firma HMAC:"), error);
    return false;
  }
}