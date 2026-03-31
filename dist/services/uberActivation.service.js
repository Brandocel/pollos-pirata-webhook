"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UberActivationService = void 0;
exports.getUberActivationService = getUberActivationService;
const axios_1 = __importDefault(require("axios"));
const chalk_1 = __importDefault(require("chalk"));
class UberActivationService {
    clientId;
    clientSecret;
    redirectUri;
    apiBaseUrl;
    authBaseUrl;
    http;
    constructor() {
        const clientId = process.env.UBER_CLIENT_ID;
        const clientSecret = process.env.UBER_CLIENT_SECRET;
        const redirectUri = process.env.UBER_REDIRECT_URI;
        const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://api.uber.com";
        const authBaseUrl = process.env.UBER_AUTH_BASE_URL || "https://auth.uber.com";
        if (!clientId) {
            throw new Error("Falta la variable de entorno UBER_CLIENT_ID");
        }
        if (!clientSecret) {
            throw new Error("Falta la variable de entorno UBER_CLIENT_SECRET");
        }
        if (!redirectUri) {
            throw new Error("Falta la variable de entorno UBER_REDIRECT_URI");
        }
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
    buildAuthorizationUrl(state) {
        const params = new URLSearchParams();
        params.append("client_id", this.clientId);
        params.append("response_type", "code");
        params.append("redirect_uri", this.redirectUri);
        params.append("scope", "eats.pos_provisioning");
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
        try {
            const response = await this.http.post(`${this.authBaseUrl}/oauth/v2/token`, form, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            });
            console.log(chalk_1.default.green("✓ Token merchant OAuth obtenido correctamente"));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error(chalk_1.default.red("Error intercambiando code por token merchant"));
                console.error(chalk_1.default.red(`Status: ${error.response?.status ?? "N/A"}`));
                console.error(chalk_1.default.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`));
            }
            throw new Error("No fue posible intercambiar el code por el token merchant");
        }
    }
    async getMerchantStores(accessToken) {
        try {
            const response = await this.http.get(`${this.apiBaseUrl}/v1/eats/stores`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const raw = response.data;
            if (Array.isArray(raw)) {
                return raw;
            }
            if (Array.isArray(raw?.stores)) {
                return raw.stores;
            }
            if (Array.isArray(raw?.data)) {
                return raw.data;
            }
            return [];
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error(chalk_1.default.red("Error obteniendo stores del merchant"));
                console.error(chalk_1.default.red(`Status: ${error.response?.status ?? "N/A"}`));
                console.error(chalk_1.default.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`));
            }
            throw new Error("No fue posible obtener las stores del merchant");
        }
    }
    async activateStore(accessToken, storeId, payload) {
        const requestBody = {};
        if (typeof payload.is_order_manager === "boolean") {
            requestBody.is_order_manager = payload.is_order_manager;
        }
        if (payload.integrator_store_id) {
            requestBody.integrator_store_id = payload.integrator_store_id;
        }
        if (payload.integrator_brand_id) {
            requestBody.integrator_brand_id = payload.integrator_brand_id;
        }
        if (payload.merchant_store_id) {
            requestBody.merchant_store_id = payload.merchant_store_id;
        }
        try {
            const response = await this.http.post(`${this.apiBaseUrl}/v1/eats/stores/${storeId}/pos_data`, requestBody, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            });
            console.log(chalk_1.default.green(`✓ Store ${storeId} activada correctamente`));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error(chalk_1.default.red(`Error activando la store ${storeId}`));
                console.error(chalk_1.default.red(`Status: ${error.response?.status ?? "N/A"}`));
                console.error(chalk_1.default.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`));
            }
            throw new Error(`No fue posible activar la store ${storeId}`);
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
