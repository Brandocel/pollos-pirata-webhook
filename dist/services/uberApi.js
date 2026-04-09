"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UberApiService = void 0;
exports.getUberApiService = getUberApiService;
const axios_1 = __importDefault(require("axios"));
const chalk_1 = __importDefault(require("chalk"));
class UberApiService {
    constructor() {
        this.accessToken = null;
        this.accessTokenExpiresAt = 0;
        const clientId = process.env.UBER_CLIENT_ID;
        const clientSecret = process.env.UBER_CLIENT_SECRET;
        const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://api.uber.com";
        const authBaseUrl = process.env.UBER_AUTH_BASE_URL || "https://auth.uber.com";
        if (!clientId) {
            throw new Error("Falta la variable de entorno UBER_CLIENT_ID");
        }
        if (!clientSecret) {
            throw new Error("Falta la variable de entorno UBER_CLIENT_SECRET");
        }
        this.clientId = clientId;
        this.clientSecret = clientSecret;
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
    async getAccessToken() {
        const now = Date.now();
        if (this.accessToken && now < this.accessTokenExpiresAt) {
            return this.accessToken;
        }
        const form = new URLSearchParams();
        form.append("client_id", this.clientId);
        form.append("client_secret", this.clientSecret);
        form.append("grant_type", "client_credentials");
        form.append("scope", "eats.store eats.order");
        try {
            const response = await this.http.post(`${this.authBaseUrl}/oauth/v2/token`, form, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            });
            const tokenData = response.data;
            this.accessToken = tokenData.access_token;
            this.accessTokenExpiresAt = Date.now() + Math.max(tokenData.expires_in - 60, 60) * 1000;
            console.log(chalk_1.default.green("✓ Token OAuth app-level de Uber obtenido correctamente"));
            return this.accessToken;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error(chalk_1.default.red("Error obteniendo token OAuth de Uber"));
                console.error(chalk_1.default.red(`Status: ${error.response?.status ?? "N/A"}`));
                console.error(chalk_1.default.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`));
            }
            throw new Error("No fue posible obtener el token OAuth de Uber");
        }
    }
    async getOrderDetails(orderId) {
        const token = await this.getAccessToken();
        try {
            const response = await this.http.get(`${this.apiBaseUrl}/v2/eats/order/${orderId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error(chalk_1.default.red(`Error al consultar el pedido ${orderId} en Uber`));
                console.error(chalk_1.default.red(`Status: ${error.response?.status ?? "N/A"}`));
                console.error(chalk_1.default.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`));
            }
            throw new Error(`No fue posible obtener el detalle del pedido ${orderId}`);
        }
    }
    async acceptOrder(orderId) {
        const token = await this.getAccessToken();
        const payload = {
            reason: "Pedido aceptado automáticamente por Pollos Pirata",
            external_reference_id: `POLLOS-PIRATA-${orderId.slice(0, 8)}`,
            order_pickup_instructions: "Pedido confirmado por Pollos Pirata",
            fields_relayed: {
                order_special_instructions: true,
                promotions: true
            }
        };
        try {
            await this.http.post(`${this.apiBaseUrl}/v1/eats/orders/${orderId}/accept_pos_order`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            console.log(chalk_1.default.green(`✓ Pedido ${orderId} aceptado automáticamente`));
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error(chalk_1.default.red(`Error al aceptar el pedido ${orderId}`));
                console.error(chalk_1.default.red(`Status: ${error.response?.status ?? "N/A"}`));
                console.error(chalk_1.default.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`));
            }
            throw new Error(`No fue posible aceptar el pedido ${orderId}`);
        }
    }
}
exports.UberApiService = UberApiService;
let uberApiServiceInstance = null;
function getUberApiService() {
    if (!uberApiServiceInstance) {
        uberApiServiceInstance = new UberApiService();
    }
    return uberApiServiceInstance;
}
