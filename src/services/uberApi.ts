import axios, { AxiosInstance } from "axios";
import chalk from "chalk";
import { UberOrderDetails } from "../types/uber";

interface UberTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface AcceptOrderPayload {
  reason: string;
  external_reference_id?: string;
  order_pickup_instructions?: string;
  pickup_time?: number;
  fields_relayed?: {
    order_special_instructions?: boolean;
    promotions?: boolean;
  };
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

  private async getAccessToken(): Promise<string> {
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
      this.accessTokenExpiresAt = Date.now() + Math.max(tokenData.expires_in - 60, 60) * 1000;

      console.log(chalk.green("✓ Token OAuth app-level de Uber obtenido correctamente"));

      return this.accessToken;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(chalk.red("Error obteniendo token OAuth de Uber"));
        console.error(chalk.red(`Status: ${error.response?.status ?? "N/A"}`));
        console.error(
          chalk.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`)
        );
      }

      throw new Error("No fue posible obtener el token OAuth de Uber");
    }
  }

  public async getOrderDetails(orderId: string): Promise<UberOrderDetails> {
    const token = await this.getAccessToken();

    try {
      const response = await this.http.get<UberOrderDetails>(
        `${this.apiBaseUrl}/v2/eats/order/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(chalk.red(`Error al consultar el pedido ${orderId} en Uber`));
        console.error(chalk.red(`Status: ${error.response?.status ?? "N/A"}`));
        console.error(
          chalk.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`)
        );
      }

      throw new Error(`No fue posible obtener el detalle del pedido ${orderId}`);
    }
  }

  public async acceptOrder(orderId: string): Promise<void> {
    const token = await this.getAccessToken();

    const payload: AcceptOrderPayload = {
      reason: "Pedido aceptado automáticamente por Pollos Pirata",
      external_reference_id: `POLLOS-PIRATA-${orderId.slice(0, 8)}`,
      order_pickup_instructions: "Pedido confirmado por Pollos Pirata",
      fields_relayed: {
        order_special_instructions: true,
        promotions: true
      }
    };

    try {
      await this.http.post(
        `${this.apiBaseUrl}/v1/eats/orders/${orderId}/accept_pos_order`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Pedido ${orderId} aceptado automáticamente`));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(chalk.red(`Error al aceptar el pedido ${orderId}`));
        console.error(chalk.red(`Status: ${error.response?.status ?? "N/A"}`));
        console.error(
          chalk.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`)
        );
      }

      throw new Error(`No fue posible aceptar el pedido ${orderId}`);
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