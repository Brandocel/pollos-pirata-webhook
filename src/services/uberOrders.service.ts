import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberOrderDetails } from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

// ============================================================
// TIPOS uAPI CORRECTOS
// ============================================================

export type UberOrderValidationAction =
  | "get"
  | "accept"
  | "deny"
  | "cancel"
  | "update"
  | "ready"
  | "resolve_fulfillment_issue";

export interface UberAcceptOrderPayload {
  ready_for_pickup_time?: string;
  external_reference_id?: string;
  accepted_by?: string;
  order_pickup_instructions?: string;
}

/**
 * uAPI - Deny Order
 * POST /v1/delivery/order/{order_id}/deny
 * deny_reason.info y deny_reason.type son requeridos por Uber.
 */
export interface UberDenyOrderPayload {
  deny_reason: {
    info: string;
    type: string;
    client_error_code?: string;
    item_metadata?: Record<string, unknown>;
  };
}

/**
 * uAPI - Cancel Order
 * POST /v1/delivery/order/{order_id}/cancel
 * cancellation_reason.info y cancellation_reason.type son requeridos por Uber.
 *
 * IMPORTANTE: La versión anterior de este archivo usaba cancellation_reason: string
 * que corresponde a la API anterior. Eso causaba que Uber rechazara las llamadas.
 */
export interface UberCancelOrderPayload {
  cancellation_reason: {
    info: string;
    type: string;
    client_error_code?: string;
    item_metadata?: Record<string, unknown>;
  };
}

export interface UberResolveFulfillmentIssuePayload {
  fulfillment_issues: Array<{
    fulfillment_issue_type: string;
    fulfillment_action_type?: string;
    root_item: {
      instance_id: string;
    };
    item_substitute?: Record<string, unknown>;
    item_availability_info?: Record<string, unknown>;
    item_adjustment?: Record<string, unknown>;
  }>;
}

export interface UberListStoreOrdersQuery {
  state?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  expand?: string;
  page_size?: number;
}

export interface UberOrderValidationFlowPayload {
  actions: UberOrderValidationAction[];
  accept_payload?: UberAcceptOrderPayload;
  deny_payload?: UberDenyOrderPayload;
  cancel_payload?: UberCancelOrderPayload;
  update_payload?: Record<string, unknown>;
  resolve_fulfillment_issue_payload?: UberResolveFulfillmentIssuePayload;
}

// ============================================================
// SERVICIO
// ============================================================

export class UberOrdersService {
  private readonly apiBaseUrl: string;
  private readonly http: AxiosInstance;

  constructor() {
    // FIX: usar api.uber.com, NO test-api.uber.com
    // Uber solo registra llamadas que llegan a api.uber.com para la validación de producción.
    const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://api.uber.com";

    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");

    this.http = axios.create({
      timeout: 20000,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip"
      }
    });
  }

  // ============================================================
  // HELPERS PRIVADOS
  // ============================================================

  private buildAxiosError(
    error: AxiosError,
    fallbackMessage: string,
    requestUrl?: string
  ): UberApiRequestError {
    const statusCode = error.response?.status ?? 500;
    const responseData = error.response?.data ?? null;

    console.error(chalk.red(fallbackMessage));
    console.error(chalk.red(`Status: ${statusCode}`));
    console.error(chalk.red(`URL: ${requestUrl ?? "N/A"}`));
    console.error(chalk.red(`Respuesta: ${JSON.stringify(responseData, null, 2)}`));

    let message = fallbackMessage;

    if (
      responseData &&
      typeof responseData === "object" &&
      "message" in responseData &&
      typeof (responseData as { message?: unknown }).message === "string"
    ) {
      message = (responseData as { message: string }).message;
    } else if (
      responseData &&
      typeof responseData === "object" &&
      "error" in responseData &&
      typeof (responseData as { error?: unknown }).error === "string"
    ) {
      message = (responseData as { error: string }).error;
    } else if (error.message) {
      message = error.message;
    }

    return new UberApiRequestError(
      message,
      statusCode,
      responseData,
      "uber",
      requestUrl
    );
  }

  private async getOrderScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken(["eats.order"]);
  }

  private async getStoreScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken(["eats.store"]);
  }

  private getAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  private normalizeUberResponse(status: number, data: unknown): unknown {
    if (status === 204) {
      return {
        success: true,
        status: 204,
        message: "Uber devolvió 204 No Content"
      };
    }

    return data ?? {};
  }

  // ============================================================
  // URL BUILDERS
  // ============================================================

  private buildDeliveryOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}`;
  }

  private buildEatsOrderDetailsUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v2/eats/order/${orderId}`;
  }

  /** uAPI - Accept Order: POST /v1/delivery/order/{order_id}/accept */
  private buildAcceptOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/accept`;
  }

  /** uAPI - Deny Order: POST /v1/delivery/order/{order_id}/deny */
  private buildDenyOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/deny`;
  }

  /** uAPI - Cancel Order: POST /v1/delivery/order/{order_id}/cancel */
  private buildCancelOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/cancel`;
  }

  private buildMarkOrderReadyUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/ready`;
  }

  private buildOrderCartUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v2/eats/orders/${orderId}/cart`;
  }

  private buildStoreOrdersUrl(storeId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/orders`;
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  public async getOrderDetails(orderId: string): Promise<UberOrderDetails> {
    const token = await this.getOrderScopedToken();
    const primaryRequestUrl = this.buildDeliveryOrderUrl(orderId);
    const fallbackRequestUrl = this.buildEatsOrderDetailsUrl(orderId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE GET ORDER DETAILS"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`primaryRequestUrl: ${primaryRequestUrl}`));

      const response = await this.http.get<UberOrderDetails>(primaryRequestUrl, {
        headers: this.getAuthHeaders(token),
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Detalle de orden obtenido correctamente para ${orderId}`));
      return response.data;
    } catch (primaryError: unknown) {
      console.log(chalk.yellow("No se pudo obtener la orden con endpoint delivery. Intentando fallback Eats..."));

      if (axios.isAxiosError(primaryError)) {
        console.log(chalk.yellow(`Primary status: ${primaryError.response?.status ?? "N/A"}`));
        console.log(chalk.yellow(`Primary response: ${JSON.stringify(primaryError.response?.data ?? {}, null, 2)}`));
      }

      try {
        console.log(chalk.cyan(`fallbackRequestUrl: ${fallbackRequestUrl}`));

        const fallbackResponse = await this.http.get<UberOrderDetails>(fallbackRequestUrl, {
          headers: this.getAuthHeaders(token),
          validateStatus: (status) => status >= 200 && status < 300
        });

        console.log(chalk.green(`✓ Detalle de orden obtenido correctamente con fallback para ${orderId}`));
        return fallbackResponse.data;
      } catch (fallbackError: unknown) {
        if (axios.isAxiosError(fallbackError)) {
          throw this.buildAxiosError(
            fallbackError,
            `No fue posible obtener el detalle de la orden ${orderId}`,
            fallbackRequestUrl
          );
        }

        throw new UberApiRequestError(
          `No fue posible obtener el detalle de la orden ${orderId}`,
          500,
          null,
          "server",
          fallbackRequestUrl
        );
      }
    }
  }

  public async listStoreOrders(
    storeId: string,
    query?: UberListStoreOrdersQuery
  ): Promise<unknown> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildStoreOrdersUrl(storeId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE LIST STORE ORDERS"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan(`query: ${JSON.stringify(query ?? {}, null, 2)}`));

      const response = await this.http.get(requestUrl, {
        headers: this.getAuthHeaders(token),
        params: query ?? {},
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Lista de órdenes obtenida correctamente para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener las órdenes de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener las órdenes de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async acceptOrder(
    orderId: string,
    payload?: UberAcceptOrderPayload
  ): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildAcceptOrderUrl(orderId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE ACCEPT ORDER uAPI"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("payload accept hacia Uber:"));
      console.log(JSON.stringify(payload ?? {}, null, 2));

      const response = await this.http.post(requestUrl, payload ?? {}, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Pedido aceptado correctamente ${orderId}`));
      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible aceptar el pedido ${orderId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible aceptar el pedido ${orderId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async denyOrder(
    orderId: string,
    payload: UberDenyOrderPayload
  ): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildDenyOrderUrl(orderId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE DENY ORDER uAPI"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("payload deny hacia Uber:"));
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.http.post(requestUrl, payload, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Pedido denegado correctamente ${orderId}`));
      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible denegar el pedido ${orderId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible denegar el pedido ${orderId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async cancelOrder(
    orderId: string,
    payload: UberCancelOrderPayload
  ): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildCancelOrderUrl(orderId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE CANCEL ORDER uAPI"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("payload cancel hacia Uber:"));
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.http.post(requestUrl, payload, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Pedido cancelado correctamente ${orderId}`));
      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible cancelar el pedido ${orderId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible cancelar el pedido ${orderId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async markOrderReady(orderId: string): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildMarkOrderReadyUrl(orderId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE MARK ORDER READY"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));

      const response = await this.http.post(requestUrl, {}, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Pedido marcado como listo correctamente ${orderId}`));
      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible marcar el pedido como listo ${orderId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible marcar el pedido como listo ${orderId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async updateOrderCart(
    orderId: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildOrderCartUrl(orderId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE UPDATE ORDER CART"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("payload update cart hacia Uber:"));
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.http.patch(requestUrl, payload, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Pedido actualizado correctamente ${orderId}`));
      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible actualizar el pedido ${orderId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible actualizar el pedido ${orderId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async resolveOrderFulfillmentIssue(
    orderId: string,
    payload: UberResolveFulfillmentIssuePayload
  ): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildOrderCartUrl(orderId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE RESOLVE ORDER FULFILLMENT ISSUE"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("payload fulfillment issue hacia Uber:"));
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.http.patch(requestUrl, payload, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Fulfillment issue enviado correctamente para orden ${orderId}`));
      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible resolver el fulfillment issue de la orden ${orderId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible resolver el fulfillment issue de la orden ${orderId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async runValidationFlow(
    orderId: string,
    payload: UberOrderValidationFlowPayload
  ): Promise<{
    order_id: string;
    steps: Array<{
      action: UberOrderValidationAction;
      ok: boolean;
      result?: unknown;
      error?: unknown;
    }>;
  }> {
    const steps: Array<{
      action: UberOrderValidationAction;
      ok: boolean;
      result?: unknown;
      error?: unknown;
    }> = [];

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
          if (!payload.deny_payload?.deny_reason?.info) {
            throw new Error("deny_payload.deny_reason.info es requerido para action=deny");
          }
          if (!payload.deny_payload?.deny_reason?.type) {
            throw new Error("deny_payload.deny_reason.type es requerido para action=deny");
          }
          const result = await this.denyOrder(orderId, payload.deny_payload);
          steps.push({ action, ok: true, result });
          continue;
        }

        if (action === "cancel") {
          if (!payload.cancel_payload?.cancellation_reason?.info) {
            throw new Error("cancel_payload.cancellation_reason.info es requerido para action=cancel");
          }
          if (!payload.cancel_payload?.cancellation_reason?.type) {
            throw new Error("cancel_payload.cancellation_reason.type es requerido para action=cancel");
          }
          const result = await this.cancelOrder(orderId, payload.cancel_payload);
          steps.push({ action, ok: true, result });
          continue;
        }

        if (action === "ready") {
          const result = await this.markOrderReady(orderId);
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

        if (action === "resolve_fulfillment_issue") {
          if (
            !payload.resolve_fulfillment_issue_payload ||
            !Array.isArray(payload.resolve_fulfillment_issue_payload.fulfillment_issues) ||
            payload.resolve_fulfillment_issue_payload.fulfillment_issues.length === 0
          ) {
            throw new Error(
              "resolve_fulfillment_issue_payload.fulfillment_issues es requerido para action=resolve_fulfillment_issue"
            );
          }
          const result = await this.resolveOrderFulfillmentIssue(
            orderId,
            payload.resolve_fulfillment_issue_payload
          );
          steps.push({ action, ok: true, result });
          continue;
        }
      } catch (error: unknown) {
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

// ============================================================
// SINGLETON + EXPORTS DE COMPATIBILIDAD
// ============================================================

let uberOrdersServiceInstance: UberOrdersService | null = null;

export function getUberOrdersService(): UberOrdersService {
  if (!uberOrdersServiceInstance) {
    uberOrdersServiceInstance = new UberOrdersService();
  }
  return uberOrdersServiceInstance;
}

/**
 * Alias de compatibilidad — uberOrders.controller.ts importa getUberApiService
 * desde este archivo a través de uberApi.ts. Mantenemos el alias aquí también
 * para que cualquier import existente siga funcionando sin cambios.
 */
export function getUberApiService(): UberOrdersService {
  return getUberOrdersService();
}