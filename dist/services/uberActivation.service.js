"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UberActivationService = exports.UberApiRequestError = void 0;
exports.getUberActivationService = getUberActivationService;
const axios_1 = __importDefault(require("axios"));
const chalk_1 = __importDefault(require("chalk"));
const uberIntegration_service_1 = require("./uberIntegration.service");
class UberApiRequestError extends Error {
    constructor(message, statusCode = 500, details = null, source = "uber", requestUrl) {
        super(message);
        this.name = "UberApiRequestError";
        this.statusCode = statusCode;
        this.details = details;
        this.source = source;
        this.requestUrl = requestUrl;
    }
}
exports.UberApiRequestError = UberApiRequestError;
class UberActivationService {
    constructor() {
        const clientId = process.env.UBER_CLIENT_ID;
        const clientSecret = process.env.UBER_CLIENT_SECRET;
        const redirectUri = process.env.UBER_REDIRECT_URI;
        const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";
        const authBaseUrl = process.env.UBER_AUTH_BASE_URL || "https://sandbox-login.uber.com";
        if (!clientId)
            throw new Error("Falta la variable de entorno UBER_CLIENT_ID");
        if (!clientSecret)
            throw new Error("Falta la variable de entorno UBER_CLIENT_SECRET");
        if (!redirectUri)
            throw new Error("Falta la variable de entorno UBER_REDIRECT_URI");
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
        this.authBaseUrl = authBaseUrl.replace(/\/+$/, "");
        this.http = axios_1.default.create({
            timeout: 20000,
            headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip"
            }
        });
    }
    buildAxiosError(error, fallbackMessage, requestUrl) {
        const statusCode = error.response?.status ?? 500;
        const responseData = error.response?.data ?? null;
        console.error(chalk_1.default.red(fallbackMessage));
        console.error(chalk_1.default.red(`Status: ${statusCode}`));
        console.error(chalk_1.default.red(`URL: ${requestUrl ?? "N/A"}`));
        console.error(chalk_1.default.red(`Respuesta: ${JSON.stringify(responseData, null, 2)}`));
        let message = fallbackMessage;
        if (responseData && typeof responseData === "object" && "message" in responseData) {
            message = String(responseData.message);
        }
        else if (responseData && typeof responseData === "object" && "error" in responseData) {
            message = String(responseData.error);
        }
        else if (error.message) {
            message = error.message;
        }
        return new UberApiRequestError(message, statusCode, responseData, "uber", requestUrl);
    }
    buildStorePosDataUrl(storeId) {
        return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/pos_data`;
    }
    isObject(value) {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }
    mapIntegrationDetails(storeId, raw) {
        const data = this.isObject(raw) ? raw : {};
        const integrationEnabled = typeof data.integration_enabled === "boolean"
            ? data.integration_enabled
            : typeof data.pos_integration_enabled === "boolean"
                ? data.pos_integration_enabled
                : undefined;
        return {
            store_id: storeId,
            is_order_manager: typeof data.is_order_manager === "boolean" ? data.is_order_manager : undefined,
            integrator_store_id: typeof data.integrator_store_id === "string" ? data.integrator_store_id : null,
            integrator_brand_id: typeof data.integrator_brand_id === "string" ? data.integrator_brand_id : null,
            merchant_store_id: typeof data.merchant_store_id === "string" ? data.merchant_store_id : null,
            integration_enabled: integrationEnabled,
            raw
        };
    }
    printIntegrationSnapshot(title, storeId, raw) {
        const data = this.isObject(raw) ? raw : {};
        console.log(chalk_1.default.blue("========================================================"));
        console.log(chalk_1.default.blue(title));
        console.log(chalk_1.default.blue(`Store ID: ${storeId}`));
        console.log(chalk_1.default.blue(`integration_enabled: ${typeof data.integration_enabled === "boolean" ? data.integration_enabled : "N/A"}`));
        console.log(chalk_1.default.blue(`pos_integration_enabled: ${typeof data.pos_integration_enabled === "boolean"
            ? data.pos_integration_enabled
            : "N/A"}`));
        console.log(chalk_1.default.blue(`order_release_enabled: ${typeof data.order_release_enabled === "boolean"
            ? data.order_release_enabled
            : "N/A"}`));
        console.log(chalk_1.default.blue(`integrator_store_id: ${typeof data.integrator_store_id === "string" ? data.integrator_store_id : "N/A"}`));
        console.log(chalk_1.default.blue(`integrator_brand_id: ${typeof data.integrator_brand_id === "string" ? data.integrator_brand_id : "N/A"}`));
        console.log(chalk_1.default.blue(`merchant_store_id: ${typeof data.merchant_store_id === "string" ? data.merchant_store_id : "N/A"}`));
        console.log(chalk_1.default.blue("========================================================"));
    }
    buildActivateQueryParams(payload) {
        const params = new URLSearchParams();
        if (typeof payload.is_order_manager === "boolean") {
            params.set("is_order_manager", String(payload.is_order_manager));
        }
        if (payload.integrator_store_id?.trim()) {
            params.set("integrator_store_id", payload.integrator_store_id.trim());
        }
        if (payload.integrator_brand_id?.trim()) {
            params.set("integrator_brand_id", payload.integrator_brand_id.trim());
        }
        if (payload.merchant_store_id?.trim()) {
            params.set("merchant_store_id", payload.merchant_store_id.trim());
        }
        if (payload.store_configuration_data != null) {
            const raw = payload.store_configuration_data;
            params.set("store_configuration_data", typeof raw === "string" ? raw : JSON.stringify(raw));
        }
        return params;
    }
    async fetchRawStoreIntegrationDetails(accessToken, storeId) {
        const requestUrl = this.buildStorePosDataUrl(storeId);
        const response = await this.http.get(requestUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return response.data;
    }
    buildAuthorizationUrl(state) {
        const params = new URLSearchParams();
        params.append("client_id", this.clientId);
        params.append("response_type", "code");
        params.append("redirect_uri", this.redirectUri);
        params.append("scope", "eats.pos_provisioning offline_access");
        params.append("state", state);
        return `${this.authBaseUrl}/oauth/v2/authorize?${params.toString()}`;
    }
    async exchangeCodeForToken(code) {
        const form = new URLSearchParams();
        form.append("client_id", this.clientId);
        form.append("client_secret", this.clientSecret);
        form.append("grant_type", "authorization_code");
        form.append("redirect_uri", this.redirectUri);
        form.append("code", code);
        const requestUrl = `${this.authBaseUrl}/oauth/v2/token`;
        try {
            const response = await this.http.post(requestUrl, form, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            });
            console.log(chalk_1.default.green("✓ Token merchant OAuth obtenido correctamente"));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, "No fue posible intercambiar el code por el token merchant", requestUrl);
            }
            throw new UberApiRequestError("No fue posible intercambiar el code por el token merchant", 500, null, "server", requestUrl);
        }
    }
    async getMerchantStores(accessToken) {
        const requestUrl = `${this.apiBaseUrl}/v1/eats/stores`;
        try {
            const response = await this.http.get(requestUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const raw = response.data;
            if (Array.isArray(raw))
                return raw;
            if (Array.isArray(raw?.stores))
                return raw.stores;
            if (Array.isArray(raw?.data))
                return raw.data;
            return [];
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, "No fue posible obtener las stores del merchant", requestUrl);
            }
            throw new UberApiRequestError("No fue posible obtener las stores del merchant", 500, null, "server", requestUrl);
        }
    }
    async activateStore(merchantAccessToken, storeId, payload) {
        const baseUrl = this.buildStorePosDataUrl(storeId);
        const params = this.buildActivateQueryParams(payload);
        const requestUrl = `${baseUrl}${params.toString() ? `?${params.toString()}` : ""}`;
        console.log(chalk_1.default.blue("========================================================"));
        console.log(chalk_1.default.blue("ACTIVATE STORE - REQUEST"));
        console.log(chalk_1.default.blue(`Store ID: ${storeId}`));
        console.log(chalk_1.default.blue(`URL: ${requestUrl}`));
        console.log(chalk_1.default.blue(`Payload lógico: ${JSON.stringify(payload, null, 2)}`));
        console.log(chalk_1.default.blue("========================================================"));
        try {
            const response = await this.http.post(requestUrl, {}, {
                headers: {
                    Authorization: `Bearer ${merchantAccessToken}`,
                    "Content-Type": "application/json"
                }
            });
            console.log(chalk_1.default.green(`✓ Solicitud de activación enviada correctamente para store ${storeId}`));
            let verification = null;
            let verificationError = null;
            try {
                const integrationService = (0, uberIntegration_service_1.getUberIntegrationService)();
                verification = await integrationService.getStoreIntegrationDetails(storeId);
                this.printIntegrationSnapshot("ESTADO DESPUÉS DE ACTIVATE (APP TOKEN)", storeId, verification.raw);
            }
            catch (error) {
                verificationError =
                    error instanceof Error ? error.message : "No fue posible verificar con app token";
                console.log(chalk_1.default.yellow("⚠ La activación fue aceptada, pero todavía no se pudo confirmar con GET /pos_data usando eats.store. " +
                    "Esto puede significar que la store sigue pendiente de provisionamiento."));
            }
            return {
                activation_response: response.data ?? {},
                verification,
                pending_provisioning: verification == null,
                verification_error: verificationError
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible activar la store ${storeId}`, requestUrl);
            }
            throw new UberApiRequestError(`No fue posible activar la store ${storeId}`, 500, null, "server", requestUrl);
        }
    }
    async getStoreIntegrationDetails(accessToken, storeId) {
        const requestUrl = this.buildStorePosDataUrl(storeId);
        try {
            const response = await this.http.get(requestUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(chalk_1.default.green(`✓ Detalles de integración obtenidos para store ${storeId}`));
            this.printIntegrationSnapshot("CONSULTA DE DETALLE DE INTEGRACIÓN", storeId, response.data);
            return this.mapIntegrationDetails(storeId, response.data);
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible obtener detalle de integración de ${storeId}`, requestUrl);
            }
            throw new UberApiRequestError(`No fue posible obtener detalle de integración de ${storeId}`, 500, null, "server", requestUrl);
        }
    }
    async updateStoreIntegration(accessToken, storeId, payload) {
        const requestUrl = this.buildStorePosDataUrl(storeId);
        const body = {};
        if (typeof payload.integration_enabled === "boolean") {
            body.integration_enabled = payload.integration_enabled;
        }
        if (typeof payload.is_order_manager === "boolean") {
            body.is_order_manager = payload.is_order_manager;
        }
        if (payload.integrator_store_id?.trim()) {
            body.integrator_store_id = payload.integrator_store_id.trim();
        }
        if (payload.integrator_brand_id?.trim()) {
            body.integrator_brand_id = payload.integrator_brand_id.trim();
        }
        if (payload.store_configuration_data != null) {
            const raw = payload.store_configuration_data;
            body.store_configuration_data =
                typeof raw === "string" ? raw : JSON.stringify(raw);
        }
        try {
            const response = await this.http.patch(requestUrl, body, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            });
            console.log(chalk_1.default.green(`✓ Integración actualizada para store ${storeId}`));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible actualizar integración de ${storeId}`, requestUrl);
            }
            throw new UberApiRequestError(`No fue posible actualizar integración de ${storeId}`, 500, null, "server", requestUrl);
        }
    }
    async removeStoreIntegration(accessToken, storeId) {
        const requestUrl = this.buildStorePosDataUrl(storeId);
        try {
            const response = await this.http.delete(requestUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log(chalk_1.default.green(`✓ Integración removida para store ${storeId}`));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible remover integración de ${storeId}`, requestUrl);
            }
            throw new UberApiRequestError(`No fue posible remover integración de ${storeId}`, 500, null, "server", requestUrl);
        }
    }
}
exports.UberActivationService = UberActivationService;
let uberActivationServiceInstance = null;
function getUberActivationService() {
    if (!uberActivationServiceInstance) {
        uberActivationServiceInstance = new UberActivationService();
    }
    return uberActivationServiceInstance;
}
