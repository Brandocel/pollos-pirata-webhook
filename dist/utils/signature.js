"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUberSignature = verifyUberSignature;
const chalk_1 = __importDefault(require("chalk"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Verifica la firma HMAC-SHA256 enviada por Uber en el header X-Uber-Signature
 * La firma es un hexadecimal en minúsculas del raw body usando el client secret.
 */
function verifyUberSignature({ rawBody, clientSecret, signatureHeader, }) {
    if (!signatureHeader || !rawBody || rawBody.length === 0) {
        console.warn(chalk_1.default.yellow("Firma o body vacío en webhook de Uber"));
        return false;
    }
    try {
        const hmac = crypto_1.default.createHmac("sha256", clientSecret);
        hmac.update(rawBody);
        const computedSignature = hmac.digest("hex").toLowerCase();
        // Comparación segura contra ataques de timing
        return crypto_1.default.timingSafeEqual(Buffer.from(computedSignature, "utf8"), Buffer.from(signatureHeader.toLowerCase(), "utf8"));
    }
    catch (error) {
        console.error(chalk_1.default.red("Error al verificar firma HMAC:"), error);
        return false;
    }
}
