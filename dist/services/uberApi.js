"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UberOrdersService = void 0;
exports.getUberOrdersService = getUberOrdersService;
exports.getUberApiService = getUberApiService;
const axios_1 = __importDefault(require("axios"));
const chalk_1 = __importDefault(require("chalk"));
const uberAppToken_service_1 = require("./uberAppToken.service");
const uberActivation_service_1 = require("./uberActivation.service");
class UberOrdersService {
    constructor() {
        const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";
        this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
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
        if (responseData &&
            typeof responseData === "object" &&
            "message" in responseData &&
            typeof responseData.message === "string") {
            message = responseData.message;
        }
        else if (responseData &&
            typeof responseData === "object" &&
            "error" in responseData &&
            typeof responseData.error === "string") {
            message = responseData.error;
        }
        else if (error.message) {
            message = error.message;
        }
        return new uberActivation_service_1.UberApiRequestError(message, statusCode, responseData, "uber", requestUrl);
    }
    async getOrderScopedToken() {
        return (0, uberAppToken_service_1.getUberAppTokenService)().getAccessToken(["eats.order"]);
    }
    async getStoreScopedToken() {
        return (0, uberAppToken_service_1.getUberAppTokenService)().getAccessToken(["eats.store"]);
    }
    getAuthHeaders(token) {
        return {
            Authorization: `Bearer ${token}`
        };
    }
    buildDeliveryOrderUrl(orderId) {
        return `${this.apiBaseUrl}/v1/delivery/order/${orderId}`;
    }
    buildAcceptOrderUrl(orderId) {
        return `${this.apiBaseUrl}/v1/eats/orders/${orderId}/accept_pos_order`;
    }
    buildDenyOrderUrl(orderId) {
        return `${this.apiBaseUrl}/v1/eats/orders/${orderId}/deny_pos_order`;
    }
    buildCancelOrderUrl(orderId) {
        return `${this.apiBaseUrl}/v1/eats/orders/${orderId}/cancel`;
    }
    buildOrderCartUrl(orderId) {
        return `${this.apiBaseUrl}/v1/eats/orders/${orderId}/cart`;
    }
    buildStoreOrdersUrl(storeId) {
        return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/orders`;
    }
    async getOrderDetails(orderId) {
        const token = await this.getOrderScopedToken();
        const requestUrl = this.buildDeliveryOrderUrl(orderId);
        try {
            const response = await this.http.get(requestUrl, {
                headers: this.getAuthHeaders(token)
            });
            console.log(chalk_1.default.green(`✓ Detalle de orden obtenido correctamente para ${orderId}`));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible obtener el detalle de la orden ${orderId}`, requestUrl);
            }
            throw new uberActivation_service_1.UberApiRequestError(`No fue posible obtener el detalle de la orden ${orderId}`, 500, null, "server", requestUrl);
        }
    }
    async listStoreOrders(storeId, query) {
        const token = await this.getStoreScopedToken();
        const requestUrl = this.buildStoreOrdersUrl(storeId);
        try {
            const response = await this.http.get(requestUrl, {
                headers: this.getAuthHeaders(token),
                params: query ?? {}
            });
            console.log(chalk_1.default.green(`✓ Lista de órdenes obtenida correctamente para store ${storeId}`));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible obtener las órdenes de la store ${storeId}`, requestUrl);
            }
            throw new uberActivation_service_1.UberApiRequestError(`No fue posible obtener las órdenes de la store ${storeId}`, 500, null, "server", requestUrl);
        }
    }
    async acceptOrder(orderId, payload) {
        const token = await this.getOrderScopedToken();
        const requestUrl = this.buildAcceptOrderUrl(orderId);
        try {
            console.log(chalk_1.default.cyan("=============================================="));
            console.log(chalk_1.default.cyan("DEBUG SERVICE ACCEPT ORDER"));
            console.log(chalk_1.default.cyan("=============================================="));
            console.log(chalk_1.default.cyan(`requestUrl: ${requestUrl}`));
            console.log(chalk_1.default.cyan("payload accept hacia Uber:"));
            console.log(JSON.stringify(payload ?? {}, null, 2));
            const response = await this.http.post(requestUrl, payload ?? {}, {
                headers: {
                    ...this.getAuthHeaders(token),
                    "Content-Type": "application/json"
                },
                validateStatus: (status) => status >= 200 && status < 300
            });
            console.log(chalk_1.default.green(`✓ Pedido aceptado correctamente ${orderId}`));
            if (response.status === 204) {
                return {
                    success: true,
                    status: 204,
                    message: "Uber devolvió 204 No Content"
                };
            }
            return response.data ?? {};
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible aceptar el pedido ${orderId}`, requestUrl);
            }
            throw new uberActivation_service_1.UberApiRequestError(`No fue posible aceptar el pedido ${orderId}`, 500, null, "server", requestUrl);
        }
    }
    async denyOrder(orderId, payload) {
        const token = await this.getOrderScopedToken();
        const requestUrl = this.buildDenyOrderUrl(orderId);
        try {
            console.log(chalk_1.default.cyan("=============================================="));
            console.log(chalk_1.default.cyan("DEBUG SERVICE DENY ORDER"));
            console.log(chalk_1.default.cyan("=============================================="));
            console.log(chalk_1.default.cyan(`requestUrl: ${requestUrl}`));
            console.log(chalk_1.default.cyan("payload deny hacia Uber:"));
            console.log(JSON.stringify(payload, null, 2));
            const response = await this.http.post(requestUrl, payload, {
                headers: {
                    ...this.getAuthHeaders(token),
                    "Content-Type": "application/json"
                },
                validateStatus: (status) => status >= 200 && status < 300
            });
            console.log(chalk_1.default.green(`✓ Pedido denegado correctamente ${orderId}`));
            if (response.status === 204) {
                return {
                    success: true,
                    status: 204,
                    message: "Uber devolvió 204 No Content"
                };
            }
            return response.data ?? {};
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible denegar el pedido ${orderId}`, requestUrl);
            }
            throw new uberActivation_service_1.UberApiRequestError(`No fue posible denegar el pedido ${orderId}`, 500, null, "server", requestUrl);
        }
    }
    async cancelOrder(orderId, payload) {
        const token = await this.getOrderScopedToken();
        const requestUrl = this.buildCancelOrderUrl(orderId);
        try {
            console.log(chalk_1.default.cyan("=============================================="));
            console.log(chalk_1.default.cyan("DEBUG SERVICE CANCEL ORDER"));
            console.log(chalk_1.default.cyan("=============================================="));
            console.log(chalk_1.default.cyan(`requestUrl: ${requestUrl}`));
            console.log(chalk_1.default.cyan("payload cancel hacia Uber:"));
            console.log(JSON.stringify(payload, null, 2));
            const response = await this.http.post(requestUrl, payload, {
                headers: {
                    ...this.getAuthHeaders(token),
                    "Content-Type": "application/json"
                },
                validateStatus: (status) => status >= 200 && status < 300
            });
            console.log(chalk_1.default.green(`✓ Pedido cancelado correctamente ${orderId}`));
            if (response.status === 204) {
                return {
                    success: true,
                    status: 204,
                    message: "Uber devolvió 204 No Content"
                };
            }
            return response.data ?? {};
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible cancelar el pedido ${orderId}`, requestUrl);
            }
            throw new uberActivation_service_1.UberApiRequestError(`No fue posible cancelar el pedido ${orderId}`, 500, null, "server", requestUrl);
        }
    }
    async updateOrderCart(orderId, payload) {
        const token = await this.getOrderScopedToken();
        const requestUrl = this.buildOrderCartUrl(orderId);
        try {
            const response = await this.http.patch(requestUrl, payload, {
                headers: {
                    ...this.getAuthHeaders(token),
                    "Content-Type": "application/json"
                }
            });
            console.log(chalk_1.default.green(`✓ Pedido actualizado correctamente ${orderId}`));
            return response.data ?? {};
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.buildAxiosError(error, `No fue posible actualizar el pedido ${orderId}`, requestUrl);
            }
            throw new uberActivation_service_1.UberApiRequestError(`No fue posible actualizar el pedido ${orderId}`, 500, null, "server", requestUrl);
        }
    }
    async runValidationFlow(orderId, payload) {
        const steps = [];
        for (const action of payload.actions) {
            try {
                if (action === "get") {
                    const result = await this.getOrderDetails(orderId);
                    steps.push({ action, ok: true, result });
                    continue;
                }
                if (action === "accept") {
                    const result = await this.acceptOrder(orderId, payload.accept_payload);
                    steps.push({ action, ok: true, result });
                    continue;
                }
                if (action === "deny") {
                    if (!payload.deny_payload?.reason?.explanation) {
                        throw new Error("deny_payload.reason.explanation es requerido para action=deny");
                    }
                    if (!payload.deny_payload?.reason?.code) {
                        throw new Error("deny_payload.reason.code es requerido para action=deny");
                    }
                    const result = await this.denyOrder(orderId, payload.deny_payload);
                    steps.push({ action, ok: true, result });
                    continue;
                }
                if (action === "cancel") {
                    if (!payload.cancel_payload?.cancellation_reason?.code) {
                        throw new Error("cancel_payload.cancellation_reason.code es requerido para action=cancel");
                    }
                    const result = await this.cancelOrder(orderId, payload.cancel_payload);
                    steps.push({ action, ok: true, result });
                    continue;
                }
                if (action === "update") {
                    if (!payload.update_payload || typeof payload.update_payload !== "object") {
                        throw new Error("update_payload es requerido para action=update");
                    }
                    const result = await this.updateOrderCart(orderId, payload.update_payload);
                    steps.push({ action, ok: true, result });
                    continue;
                }
            }
            catch (error) {
                steps.push({
                    action,
                    ok: false,
                    error: error instanceof Error ? error.message : error
                });
            }
        }
        return {
            order_id: orderId,
            steps
        };
    }
}
exports.UberOrdersService = UberOrdersService;
let uberOrdersServiceInstance = null;
function getUberOrdersService() {
    if (!uberOrdersServiceInstance) {
        uberOrdersServiceInstance = new UberOrdersService();
    }
    return uberOrdersServiceInstance;
}
function getUberApiService() {
    return getUberOrdersService();
}
