import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberOrderDetails } from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export type UberOrderValidationAction =
  | "get"
  | "accept"
  | "deny"
  | "cancel"
  | "update"
  | "ready"
  | "resolve_fulfillment_issue";

export interface UberAcceptOrderPayload {
  reason?: string;
  pickup_time?: number;
  external_reference_id?: string;
  fields_relayed?: {
    order_special_instructions?: boolean;
    item_special_instructions?: boolean;
    item_special_requests?: boolean;
    promotions?: boolean;
  };
  order_pickup_instructions?: string;
}

export interface UberDenyOrderPayload {
  reason: {
    explanation: string;
    code: string;
    out_of_stock_items?: string[];
    invalid_items?: string[];
  };
}

export interface UberCancelOrderPayload {
  reason: string;
  details?: string;
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

export class UberOrdersService {
  private readonly apiBaseUrl: string;
  private readonly http: AxiosInstance;

  constructor() {
    const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";

    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");

    this.http = axios.create({
      timeout: 20000,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip"
      }
    });
  }

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

  private buildDeliveryOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}`;
  }

  private buildEatsOrderDetailsUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v2/eats/order/${orderId}`;
  }

  private buildAcceptOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/eats/orders/${orderId}/accept_pos_order`;
  }

  private buildDenyOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/eats/orders/${orderId}/deny_pos_order`;
  }

  private buildCancelOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/eats/orders/${orderId}/cancel`;
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
      console.log(
        chalk.yellow("No se pudo obtener la orden con endpoint delivery. Intentando fallback Eats...")
      );

      if (axios.isAxiosError(primaryError)) {
        console.log(chalk.yellow(`Primary status: ${primaryError.response?.status ?? "N/A"}`));
        console.log(
          chalk.yellow(
            `Primary response: ${JSON.stringify(primaryError.response?.data ?? {}, null, 2)}`
          )
        );
      }

      try {
        console.log(chalk.cyan(`fallbackRequestUrl: ${fallbackRequestUrl}`));

        const fallbackResponse = await this.http.get<UberOrderDetails>(
          fallbackRequestUrl,
          {
            headers: this.getAuthHeaders(token),
            validateStatus: (status) => status >= 200 && status < 300
          }
        );

        console.log(
          chalk.green(`✓ Detalle de orden obtenido correctamente con fallback para ${orderId}`)
        );

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
      console.log(chalk.cyan("DEBUG SERVICE ACCEPT ORDER"));
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
      console.log(chalk.cyan("DEBUG SERVICE DENY ORDER"));
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
      console.log(chalk.cyan("DEBUG SERVICE CANCEL ORDER"));
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

      const response = await this.http.post(
        requestUrl,
        {},
        {
          headers: {
            ...this.getAuthHeaders(token),
            "Content-Type": "application/json"
          },
          validateStatus: (status) => status >= 200 && status < 300
        }
      );

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

      console.log(
        chalk.green(`✓ Fulfillment issue enviado correctamente para orden ${orderId}`)
      );

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
          if (!payload.cancel_payload?.reason) {
            throw new Error("cancel_payload.reason es requerido para action=cancel");
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

let uberOrdersServiceInstance: UberOrdersService | null = null;

export function getUberOrdersService(): UberOrdersService {
  if (!uberOrdersServiceInstance) {
    uberOrdersServiceInstance = new UberOrdersService();
  }

  return uberOrdersServiceInstance;
}

export function getUberApiService(): UberOrdersService {
  return getUberOrdersService();
}