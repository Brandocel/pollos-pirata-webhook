import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberOrderDetails } from "../types/uber";

interface UberTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface AcceptOrderPayload {
  ready_for_pickup_time?: string;
  external_reference_id?: string;
  accepted_by?: string;
  order_pickup_instructions?: string;
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

  private logAxiosError(error: AxiosError, fallbackMessage: string): void {
    console.error(chalk.red(fallbackMessage));
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
    form.append("scope", "eats.order");

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

  /**
   * Según el OpenAPI de Order Fulfillment:
   * GET /v1/delivery/order/{order_id}
   * Scope: eats.order
   */
  public async getOrderDetails(orderId: string): Promise<UberOrderDetails> {
    const token = await this.getAccessToken();
    const requestUrl = this.buildUrl(`/v1/delivery/order/${orderId}`);

    try {
      const response = await this.http.get<UberOrderDetails>(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          expand: "carts,payment"
        }
      });

      console.log(chalk.green(`✓ Detalle de orden obtenido correctamente para ${orderId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, `Error al consultar el pedido ${orderId} en Uber`);
      }

      throw new Error(`No fue posible obtener el detalle del pedido ${orderId}`);
    }
  }

  /**
   * Según el OpenAPI de Order Fulfillment:
   * POST /v1/delivery/order/{order_id}/accept
   * Scope: eats.order
   */
  public async acceptOrder(orderId: string): Promise<void> {
    const token = await this.getAccessToken();
    const requestUrl = this.buildUrl(`/v1/delivery/order/${orderId}/accept`);

    const acceptedBy = process.env.UBER_ACCEPTED_BY?.trim() || "Pollos Pirata";
    const pickupInstructions =
      process.env.UBER_PICKUP_INSTRUCTIONS?.trim() ||
      "Pedido confirmado por Pollos Pirata";

    const payload: AcceptOrderPayload = {
      external_reference_id: `POLLOS-PIRATA-${orderId.slice(0, 8)}`,
      accepted_by: acceptedBy,
      order_pickup_instructions: pickupInstructions
    };

    try {
      await this.http.post(requestUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Pedido ${orderId} aceptado correctamente`));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, `Error al aceptar el pedido ${orderId}`);
      }

      throw new Error(`No fue posible aceptar el pedido ${orderId}`);
    }
  }

  /**
   * Útil para depuración si quieres revisar si la orden existe por tienda
   * según el mismo OpenAPI:
   * GET /v1/delivery/store/{store_id}/orders
   */
  public async listStoreOrders(
    storeId: string,
    params?: {
      state?: string;
      status?: string;
      start_time?: string;
      end_time?: string;
      page_size?: number;
      expand?: string;
    }
  ): Promise<unknown> {
    const token = await this.getAccessToken();
    const requestUrl = this.buildUrl(`/v1/delivery/store/${storeId}/orders`);

    try {
      const response = await this.http.get(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          expand: params?.expand ?? "carts,payment",
          state: params?.state,
          status: params?.status,
          start_time: params?.start_time,
          end_time: params?.end_time,
          page_size: params?.page_size ?? 20
        }
      });

      console.log(chalk.green(`✓ Lista de órdenes obtenida correctamente para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logAxiosError(error, `Error al listar órdenes de la store ${storeId}`);
      }

      throw new Error(`No fue posible listar las órdenes de la store ${storeId}`);
    }
  }
}

let uberApiServiceInstance: UberApiService | null = null;

export function getUberApiService(): UberApiService {
  if (!uberApiServiceInstance) {
    uberApiServiceInstance = new UberApiService();
  }

  return uberApiServiceInstance;
}