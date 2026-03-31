"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startUberLogin = startUberLogin;
exports.handleUberAuthCallback = handleUberAuthCallback;
exports.getMerchantStores = getMerchantStores;
exports.activateMerchantStore = activateMerchantStore;
exports.getMerchantSessionInfo = getMerchantSessionInfo;
const chalk_1 = __importDefault(require("chalk"));
const crypto_1 = __importDefault(require("crypto"));
const uberActivation_service_1 = require("../services/uberActivation.service");
const oauthStateStore = new Map();
let merchantSession = null;
function createState() {
    return crypto_1.default.randomBytes(24).toString("hex");
}
function isMerchantSessionValid() {
    if (!merchantSession)
        return false;
    return Date.now() < merchantSession.expiresAt;
}
async function startUberLogin(req, res) {
    try {
        const activationService = (0, uberActivation_service_1.getUberActivationService)();
        const state = createState();
        oauthStateStore.set(state, Date.now());
        const url = activationService.buildAuthorizationUrl(state);
        res.redirect(url);
    }
    catch (error) {
        console.error(chalk_1.default.red("Error iniciando OAuth con Uber"));
        if (error instanceof Error) {
            console.error(chalk_1.default.red(error.message));
        }
        res.status(500).json({
            ok: false,
            message: "No fue posible iniciar sesión con Uber"
        });
    }
}
async function handleUberAuthCallback(req, res) {
    try {
        const { code, state, error, error_description } = req.query;
        if (error) {
            res.status(400).json({
                ok: false,
                message: "Uber devolvió un error en OAuth",
                error,
                error_description: error_description ?? null
            });
            return;
        }
        if (!code || typeof code !== "string") {
            res.status(400).json({
                ok: false,
                message: "No se recibió el code de autorización"
            });
            return;
        }
        if (!state || typeof state !== "string") {
            res.status(400).json({
                ok: false,
                message: "No se recibió el state"
            });
            return;
        }
        const storedAt = oauthStateStore.get(state);
        if (!storedAt) {
            res.status(400).json({
                ok: false,
                message: "State inválido o expirado"
            });
            return;
        }
        oauthStateStore.delete(state);
        const activationService = (0, uberActivation_service_1.getUberActivationService)();
        const tokenResponse = await activationService.exchangeCodeForToken(code);
        const stores = await activationService.getMerchantStores(tokenResponse.access_token);
        merchantSession = {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: Date.now() + Math.max(tokenResponse.expires_in - 60, 60) * 1000,
            scope: tokenResponse.scope
        };
        console.log(chalk_1.default.green("✓ Merchant autenticado correctamente con Uber"));
        res.status(200).json({
            ok: true,
            message: "Merchant autenticado correctamente",
            data: {
                scope: tokenResponse.scope ?? null,
                expires_in: tokenResponse.expires_in,
                stores
            }
        });
    }
    catch (error) {
        console.error(chalk_1.default.red("Error en callback OAuth de Uber"));
        if (error instanceof Error) {
            console.error(chalk_1.default.red(error.message));
        }
        res.status(500).json({
            ok: false,
            message: "No fue posible completar la autenticación con Uber"
        });
    }
}
async function getMerchantStores(req, res) {
    try {
        if (!isMerchantSessionValid() || !merchantSession) {
            res.status(401).json({
                ok: false,
                message: "No hay una sesión de merchant activa. Primero entra a /uber/auth/login"
            });
            return;
        }
        const activationService = (0, uberActivation_service_1.getUberActivationService)();
        const stores = await activationService.getMerchantStores(merchantSession.accessToken);
        res.status(200).json({
            ok: true,
            message: "Tiendas obtenidas correctamente",
            data: stores
        });
    }
    catch (error) {
        console.error(chalk_1.default.red("Error obteniendo stores del merchant"));
        if (error instanceof Error) {
            console.error(chalk_1.default.red(error.message));
        }
        res.status(500).json({
            ok: false,
            message: "No fue posible obtener las tiendas del merchant"
        });
    }
}
async function activateMerchantStore(req, res) {
    try {
        if (!isMerchantSessionValid() || !merchantSession) {
            res.status(401).json({
                ok: false,
                message: "No hay una sesión de merchant activa. Primero entra a /uber/auth/login"
            });
            return;
        }
        const { storeId } = req.params;
        if (!storeId || Array.isArray(storeId)) {
            res.status(400).json({
                ok: false,
                message: "Falta el storeId o el formato es inválido"
            });
            return;
        }
        const body = req.body;
        const payload = {
            is_order_manager: typeof body?.is_order_manager === "boolean"
                ? body.is_order_manager
                : process.env.UBER_IS_ORDER_MANAGER === "true",
            integrator_store_id: body?.integrator_store_id ??
                process.env.UBER_DEFAULT_INTEGRATOR_STORE_ID ??
                undefined,
            integrator_brand_id: body?.integrator_brand_id ??
                process.env.UBER_DEFAULT_INTEGRATOR_BRAND_ID ??
                undefined,
            merchant_store_id: body?.merchant_store_id ??
                process.env.UBER_DEFAULT_MERCHANT_STORE_ID ??
                undefined
        };
        const result = await (0, uberActivation_service_1.getUberActivationService)().activateStore(merchantSession.accessToken, storeId, payload);
        res.status(200).json({
            ok: true,
            message: "Store activada correctamente",
            data: result
        });
    }
    catch (error) {
        console.error(chalk_1.default.red("Error activando store del merchant"));
        if (error instanceof Error) {
            console.error(chalk_1.default.red(error.message));
        }
        res.status(500).json({
            ok: false,
            message: "No fue posible activar la store"
        });
    }
}
async function getMerchantSessionInfo(_req, res) {
    res.status(200).json({
        ok: true,
        data: {
            authenticated: isMerchantSessionValid(),
            expiresAt: merchantSession?.expiresAt ?? null,
            scope: merchantSession?.scope ?? null
        }
    });
}
