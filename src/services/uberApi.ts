import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import chalk from "chalk";
import { UberOrderDetails } from "../types/uber";

interface UberTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface UberCancelOrderPayload {
  cancellation_reason: string;
}

export interface ListStoreOrdersParams {
  state?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  page_size?: number;
  expand?: string;
}

export interface UberOrderValidationFlowPayload {
  actions: Array<"get" | "accept" | "deny" | "cancel" | "update">;
  cancel_payload?: UberCancelOrderPayload;
  update_payload?: Record<string, unknown>;
}

export interface UberOrderValidationFlowResult {
  order_id: string;
  executed_at: string;
  results: Array<{
    action: "get" | "accept" | "deny" | "cancel" | "update";
    ok: boolean;
    detail: string;
    response?: unknown;
    error?: unknown;
  }>;
}

export class UberApiService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiBaseUrl: string;
  private readonly authBaseUrl: string;
  private readonly http: AxiosInstance;

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor() {
    const clientId = process.env.UBER_CLIENT_ID;
    const clientSecret = process.env.UBER_CLIENT_SECRET;
    const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";
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

    this.http = axios.create({
      timeout: 20000,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip"
      }
    });
  }

  private buildUrl(path: string): string {
    return `${this.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private logAxiosError(error: AxiosError, fallbackMessage: string, requestUrl?: string): void {
    console.error(chalk.red(fallbackMessage));
    console.error(chalk.red(`URL: ${requestUrl ?? "N/A"}`));
    console.error(chalk.red(`Status: ${error.response?.status ?? "N/A"}`));
    console.error(
      chalk.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`)
    );
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const form = new URLSearchParams();
    form.append("client_id", this.clientId);
    form.append("client_secret", this.clientSecret);
    form.append("grant_type", "client_credentials");
    form.append("scope", "eats.order eats.store");

    try {
      const response = await this.http.post<UberTokenResponse>(
        `${this.authBaseUrl}/oauth/v2/token`,
        form,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );

      const tokenData = response.data;
      this.accessToken = tokenData.access_token;
      this.accessTokenExpiresAt =
        Date.now() + Math.max(tokenData.expires_in - 60, 60) * 1000;

      console.log(chalk.green("✓ Token OAuth app-level de Uber obtenido correctamente"));
      console.log(chalk.green(`✓ Scope devuelto: ${tokenData.scope ?? "N/A"}`));

      return this.accessToken;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, "Error obteniendo token OAuth de Uber");
      }

      throw new Error("No fue posible obtener el token OAuth de Uber");
    }
  }

  private async requestWithFallback<T>(
    requests: Array<() => Promise<AxiosResponse<T>>>,
    fallbackMessage: string
  ): Promise<T> {
    let lastError: unknown = null;

    for (const request of requests) {
      try {
        const response = await request();
        return response.data;
      } catch (error: unknown) {
        lastError = error;
      }
    }

    if (axios.isAxiosError(lastError)) {
      this.logAxiosError(lastError, fallbackMessage, lastError.config?.url);
    }

    throw new Error(fallbackMessage);
  }

  public async getOrderDetails(orderId: string): Promise<UberOrderDetails> {
    const token = await this.getAccessToken();

    const officialUrl = this.buildUrl(`/v1/delivery/order/${orderId}`);
    const altUrl = this.buildUrl(`/v2/eats/order/${orderId}`);

    return this.requestWithFallback<UberOrderDetails>(
      [
        () =>
          this.http.get<UberOrderDetails>(officialUrl, {
            headers: { Authorization: `Bearer ${token}` }
          }),
        () =>
          this.http.get<UberOrderDetails>(altUrl, {
            headers: { Authorization: `Bearer ${token}` }
          })
      ],
      `No fue posible obtener el detalle del pedido ${orderId}`
    );
  }

  public async acceptOrder(orderId: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const requestUrl = this.buildUrl(`/v1/delivery/order/${orderId}/accept`);

    try {
      const response = await this.http.post(
        requestUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Pedido ${orderId} aceptado correctamente`));
      return response.data ?? {};
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, `Error al aceptar el pedido ${orderId}`, requestUrl);
      }

      throw new Error(`No fue posible aceptar el pedido ${orderId}`);
    }
  }

  public async denyOrder(orderId: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const requestUrl = this.buildUrl(`/v1/delivery/order/${orderId}/deny`);

    try {
      const response = await this.http.post(
        requestUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Pedido ${orderId} denegado correctamente`));
      return response.data ?? {};
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, `Error al denegar el pedido ${orderId}`, requestUrl);
      }

      throw new Error(`No fue posible denegar el pedido ${orderId}`);
    }
  }

  public async cancelOrder(
    orderId: string,
    payload: UberCancelOrderPayload
  ): Promise<unknown> {
    const token = await this.getAccessToken();
    const requestUrl = this.buildUrl(`/v1/delivery/order/${orderId}/cancel`);

    try {
      const response = await this.http.post(requestUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Pedido ${orderId} cancelado correctamente`));
      return response.data ?? {};
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, `Error al cancelar el pedido ${orderId}`, requestUrl);
      }

      throw new Error(`No fue posible cancelar el pedido ${orderId}`);
    }
  }

  public async updateOrderCart(
    orderId: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    const token = await this.getAccessToken();
    const requestUrl = this.buildUrl(`/v2/eats/orders/${orderId}/cart`);

    try {
      const response = await this.http.patch(requestUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Cart del pedido ${orderId} actualizado correctamente`));
      return response.data ?? {};
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, `Error al actualizar el pedido ${orderId}`, requestUrl);
      }

      throw new Error(`No fue posible actualizar el pedido ${orderId}`);
    }
  }

  public async listStoreOrders(
    storeId: string,
    params?: ListStoreOrdersParams
  ): Promise<unknown> {
    const token = await this.getAccessToken();

    const officialUrl = this.buildUrl(`/v1/delivery/store/${storeId}/orders`);
    const altUrl = this.buildUrl(`/v1/eats/stores/${storeId}/orders`);

    return this.requestWithFallback<unknown>(
      [
        () =>
          this.http.get(officialUrl, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              expand: params?.expand ?? "carts,payment",
              state: params?.state,
              status: params?.status,
              start_time: params?.start_time,
              end_time: params?.end_time,
              page_size: params?.page_size ?? 20
            }
          }),
        () =>
          this.http.get(altUrl, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              expand: params?.expand ?? "carts,payment",
              state: params?.state,
              status: params?.status,
              start_time: params?.start_time,
              end_time: params?.end_time,
              page_size: params?.page_size ?? 20
            }
          })
      ],
      `No fue posible listar las órdenes de la store ${storeId}`
    );
  }

  public async runValidationFlow(
    orderId: string,
    flow: UberOrderValidationFlowPayload
  ): Promise<UberOrderValidationFlowResult> {
    const results: UberOrderValidationFlowResult["results"] = [];

    for (const action of flow.actions) {
      try {
        switch (action) {
          case "get": {
            const response = await this.getOrderDetails(orderId);
            results.push({
              action,
              ok: true,
              detail: "Get Order Details ejecutado correctamente",
              response
            });
            break;
          }

          case "accept": {
            const response = await this.acceptOrder(orderId);
            results.push({
              action,
              ok: true,
              detail: "Accept Order ejecutado correctamente",
              response
            });
            break;
          }

          case "deny": {
            const response = await this.denyOrder(orderId);
            results.push({
              action,
              ok: true,
              detail: "Deny Order ejecutado correctamente",
              response
            });
            break;
          }

          case "cancel": {
            if (!flow.cancel_payload?.cancellation_reason) {
              throw new Error("cancel_payload.cancellation_reason es requerido para ejecutar cancel");
            }

            const response = await this.cancelOrder(orderId, flow.cancel_payload);
            results.push({
              action,
              ok: true,
              detail: "Cancel Order ejecutado correctamente",
              response
            });
            break;
          }

          case "update": {
            if (!flow.update_payload) {
              throw new Error("update_payload es requerido para ejecutar update");
            }

            const response = await this.updateOrderCart(orderId, flow.update_payload);
            results.push({
              action,
              ok: true,
              detail: "Update Order/Cart ejecutado correctamente",
              response
            });
            break;
          }

          default:
            results.push({
              action,
              ok: false,
              detail: "Acción no soportada"
            });
        }
      } catch (error: unknown) {
        results.push({
          action,
          ok: false,
          detail:
            error instanceof Error ? error.message : "Error desconocido ejecutando acción",
          error: error instanceof Error ? { message: error.message } : error
        });
      }
    }

    return {
      order_id: orderId,
      executed_at: new Date().toISOString(),
      results
    };
  }
}

let uberApiServiceInstance: UberApiService | null = null;

export function getUberApiService(): UberApiService {
  if (!uberApiServiceInstance) {
    uberApiServiceInstance = new UberApiService();
  }

  return uberApiServiceInstance;
}