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
const uberActivation_service_1 = require("../services/uberActivation.service");
const oauthState_1 = require("../utils/oauthState");
const merchantSessionToken_1 = require("../utils/merchantSessionToken");
function getBearerToken(req) {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
        return null;
    }
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
        return null;
    }
    return token.trim();
}
function getSessionFromRequest(req) {
    const token = getBearerToken(req);
    if (!token) {
        return null;
    }
    return (0, merchantSessionToken_1.readMerchantSessionToken)(token);
}
function sendDetailedError(res, defaultMessage, error, context) {
    console.error(chalk_1.default.red(defaultMessage));
    if (error instanceof uberActivation_service_1.UberApiRequestError) {
        console.error(chalk_1.default.red(error.message));
        res.status(error.statusCode).json({
            ok: false,
            message: defaultMessage,
            error: {
                source: error.source,
                statusCode: error.statusCode,
                detail: error.message,
                requestUrl: error.requestUrl ?? null,
                response: error.details ?? null,
                context: context ?? null
            }
        });
        return;
    }
    if (error instanceof Error) {
        console.error(chalk_1.default.red(error.message));
        res.status(500).json({
            ok: false,
            message: defaultMessage,
            error: {
                source: "server",
                statusCode: 500,
                detail: error.message,
                requestUrl: null,
                response: null,
                context: context ?? null
            }
        });
        return;
    }
    console.error(chalk_1.default.red("Error desconocido"));
    res.status(500).json({
        ok: false,
        message: defaultMessage,
        error: {
            source: "server",
            statusCode: 500,
            detail: "Error desconocido",
            requestUrl: null,
            response: null,
            context: context ?? null
        }
    });
}
function requireValidSession(req, res) {
    const session = getSessionFromRequest(req);
    if (!session) {
        res.status(401).json({
            ok: false,
            message: "Sesión merchant inválida o expirada"
        });
        return null;
    }
    return session;
}
function requireValidStoreId(req, res) {
    const { storeId } = req.params;
    if (!storeId || Array.isArray(storeId)) {
        res.status(400).json({
            ok: false,
            message: "Falta el storeId o el formato es inválido"
        });
        return null;
    }
    return storeId;
}
async function startUberLogin(req, res) {
    try {
        const activationService = (0, uberActivation_service_1.getUberActivationService)();
        const state = (0, oauthState_1.createOAuthState)();
        const url = activationService.buildAuthorizationUrl(state);
        return void res.redirect(url);
    }
    catch (error) {
        return sendDetailedError(res, "No fue posible iniciar sesión con Uber", error);
    }
}
async function handleUberAuthCallback(req, res) {
    try {
        const { code, state, error, error_description } = req.query;
        if (error) {
            return void res.status(400).json({
                ok: false,
                message: "Uber devolvió un error en OAuth",
                error: {
                    source: "uber",
                    statusCode: 400,
                    detail: typeof error === "string" ? error : "OAuth error",
                    response: {
                        error,
                        error_description: error_description ?? null
                    }
                }
            });
        }
        if (!code || typeof code !== "string") {
            return void res.status(400).json({
                ok: false,
                message: "No se recibió el code de autorización"
            });
        }
        if (!state || typeof state !== "string") {
            return void res.status(400).json({
                ok: false,
                message: "No se recibió el state"
            });
        }
        const statePayload = (0, oauthState_1.verifyOAuthState)(state);
        if (!statePayload) {
            return void res.status(400).json({
                ok: false,
                message: "State inválido o expirado"
            });
        }
        const activationService = (0, uberActivation_service_1.getUberActivationService)();
        const tokenResponse = await activationService.exchangeCodeForToken(code);
        const stores = await activationService.getMerchantStores(tokenResponse.access_token);
        const sessionToken = (0, merchantSessionToken_1.createMerchantSessionToken)({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: Date.now() + Math.max(tokenResponse.expires_in - 60, 60) * 1000,
            scope: tokenResponse.scope
        });
        console.log(chalk_1.default.green("✓ Merchant autenticado correctamente con Uber"));
        return void res.status(200).json({
            ok: true,
            message: "Merchant autenticado correctamente",
            data: {
                session_token: sessionToken,
                scope: tokenResponse.scope ?? null,
                expires_in: tokenResponse.expires_in,
                stores
            }
        });
    }
    catch (error) {
        return sendDetailedError(res, "No fue posible completar la autenticación con Uber", error);
    }
}
async function getMerchantStores(req, res) {
    try {
        const session = requireValidSession(req, res);
        if (!session) {
            return;
        }
        const activationService = (0, uberActivation_service_1.getUberActivationService)();
        const stores = await activationService.getMerchantStores(session.accessToken);
        return void res.status(200).json({
            ok: true,
            message: "Tiendas obtenidas correctamente",
            data: stores
        });
    }
    catch (error) {
        return sendDetailedError(res, "No fue posible obtener las tiendas del merchant", error);
    }
}
async function activateMerchantStore(req, res) {
    try {
        const session = requireValidSession(req, res);
        if (!session) {
            return;
        }
        const storeId = requireValidStoreId(req, res);
        if (!storeId) {
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
        const result = await (0, uberActivation_service_1.getUberActivationService)().activateStore(session.accessToken, storeId, payload);
        return void res.status(200).json({
            ok: true,
            message: "Store activada correctamente",
            data: result
        });
    }
    catch (error) {
        return sendDetailedError(res, "No fue posible activar la store", error, {
            storeId: req.params.storeId ?? null,
            requestBody: {
                is_order_manager: req.body?.is_order_manager ?? null,
                integrator_store_id: req.body?.integrator_store_id ?? null,
                integrator_brand_id: req.body?.integrator_brand_id ?? null,
                merchant_store_id: req.body?.merchant_store_id ?? null
            }
        });
    }
}
async function getMerchantSessionInfo(req, res) {
    try {
        const session = getSessionFromRequest(req);
        return void res.status(200).json({
            ok: true,
            data: {
                authenticated: !!session,
                expiresAt: session?.expiresAt ?? null,
                scope: session?.scope ?? null
            }
        });
    }
    catch (error) {
        return sendDetailedError(res, "No fue posible obtener la sesión del merchant", error);
    }
}
