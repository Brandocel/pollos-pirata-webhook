import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberOrderDetails } from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

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

  private buildGetOrderDetailsUrl(orderId: string): string {
    return `${this.apiBaseUrl}/v2/eats/order/${orderId}`;
  }

  private async getOrderScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken(["eats.order"]);
  }

  public async getOrderDetails(orderId: string): Promise<UberOrderDetails> {
    const token = await this.getOrderScopedToken();
    const requestUrl = this.buildGetOrderDetailsUrl(orderId);

    try {
      const response = await this.http.get<UberOrderDetails>(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
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
}

let uberOrdersServiceInstance: UberOrdersService | null = null;

export function getUberOrdersService(): UberOrdersService {
  if (!uberOrdersServiceInstance) {
    uberOrdersServiceInstance = new UberOrdersService();
  }

  return uberOrdersServiceInstance;
}