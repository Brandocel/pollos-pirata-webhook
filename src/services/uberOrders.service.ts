import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberOrderDetails } from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export interface UberCancelOrderPayload {
  cancellation_reason: string;
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
  actions: Array<"get" | "accept" | "deny" | "cancel" | "update">;
  cancel_payload?: UberCancelOrderPayload;
  update_payload?: Record<string, unknown>;
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

  private buildDeliveryOrderUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}`;
  }

  private buildDeliveryOrderAcceptUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/accept`;
  }

  private buildDeliveryOrderDenyUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/deny`;
  }

  private buildDeliveryOrderCancelUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/cancel`;
  }

  private buildDeliveryOrderCartUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v1/delivery/order/${orderId}/cart`;
  }

  private buildStoreOrdersUrl(storeId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/orders`;
  }

  public async getOrderDetails(orderId: string): Promise<UberOrderDetails> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildDeliveryOrderUrl(orderId);

    try {
      const response = await this.http.get<UberOrderDetails>(requestUrl, {
        headers: this.getAuthHeaders(token)
      });

      console.log(chalk.green(`✓ Detalle de orden obtenido correctamente para ${orderId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener el detalle de la orden ${orderId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener el detalle de la orden ${orderId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async listStoreOrders(
    storeId: string,
    query?: UberListStoreOrdersQuery
  ): Promise<unknown> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildStoreOrdersUrl(storeId);

    try {
      const response = await this.http.get(requestUrl, {
        headers: this.getAuthHeaders(token),
        params: query ?? {}
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

  public async acceptOrder(orderId: string): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildDeliveryOrderAcceptUrl(orderId);

    try {
      const response = await this.http.post(
        requestUrl,
        {},
        {
          headers: {
            ...this.getAuthHeaders(token),
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Pedido aceptado correctamente ${orderId}`));
      return response.data ?? {};
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

  public async denyOrder(orderId: string): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildDeliveryOrderDenyUrl(orderId);

    try {
      const response = await this.http.post(
        requestUrl,
        {},
        {
          headers: {
            ...this.getAuthHeaders(token),
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Pedido denegado correctamente ${orderId}`));
      return response.data ?? {};
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
    const requestUrl = this.buildDeliveryOrderCancelUrl(orderId);

    try {
      const response = await this.http.post(
        requestUrl,
        payload,
        {
          headers: {
            ...this.getAuthHeaders(token),
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Pedido cancelado correctamente ${orderId}`));
      return response.data ?? {};
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

  public async updateOrderCart(
    orderId: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildDeliveryOrderCartUrl(orderId);

    try {
      const response = await this.http.patch(
        requestUrl,
        payload,
        {
          headers: {
            ...this.getAuthHeaders(token),
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Pedido actualizado correctamente ${orderId}`));
      return response.data ?? {};
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

  public async runValidationFlow(
    orderId: string,
    payload: UberOrderValidationFlowPayload
  ): Promise<{
    order_id: string;
    steps: Array<{
      action: "get" | "accept" | "deny" | "cancel" | "update";
      ok: boolean;
      result?: unknown;
      error?: unknown;
    }>;
  }> {
    const steps: Array<{
      action: "get" | "accept" | "deny" | "cancel" | "update";
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
          const result = await this.acceptOrder(orderId);
          steps.push({ action, ok: true, result });
          continue;
        }

        if (action === "deny") {
          const result = await this.denyOrder(orderId);
          steps.push({ action, ok: true, result });
          continue;
        }

        if (action === "cancel") {
          if (!payload.cancel_payload?.cancellation_reason) {
            throw new Error("cancel_payload.cancellation_reason es requerido para action=cancel");
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
      } catch (error: unknown) {
        steps.push({
          action,
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : error
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