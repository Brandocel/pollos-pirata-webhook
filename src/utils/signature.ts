import chalk from "chalk";
import crypto from "crypto";

interface VerifyUberSignatureParams {
  rawBody: Buffer;
  clientSecret: string;
  signatureHeader?: string;
}

/**
 * Verifica la firma HMAC-SHA256 enviada por Uber en el header X-Uber-Signature
 * La firma es un hexadecimal en minúsculas del raw body usando el client secret.
 */
export function verifyUberSignature({
  rawBody,
  clientSecret,
  signatureHeader,
}: VerifyUberSignatureParams): boolean {
  if (!signatureHeader || !rawBody || rawBody.length === 0) {
    console.warn(chalk.yellow("Firma o body vacío en webhook de Uber"));
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", clientSecret);
    hmac.update(rawBody);
    const computedSignature = hmac.digest("hex").toLowerCase();

    // Comparación segura contra ataques de timing
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, "utf8"),
      Buffer.from(signatureHeader.toLowerCase(), "utf8")
    );
  } catch (error) {
    console.error(chalk.red("Error al verificar firma HMAC:"), error);
    return false;
  }
}