import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export interface UberStoreStatusPayload extends Record<string, unknown> {
  status?: string;
  reason?: string;
  pause_until?: string;
}

export class UberStoreStatusService {
  private readonly apiBaseUrl: string;
  private readonly http: AxiosInstance;

  constructor() {
    const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";

    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");

    this.http = axios.create({
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
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
    } else if (
      responseData &&
      typeof responseData === "object" &&
      "code" in responseData &&
      typeof (responseData as { code?: unknown }).code === "string"
    ) {
      message = (responseData as { code: string }).code;
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

  private getAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  private async getStoreStatusWriteToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken([
      "eats.store.status.write"
    ]);
  }

  private async getStoreStatusReadToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken([
      "eats.store.status.read"
    ]);
  }

  private async getRestaurantDeliveryStatusToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken([
      "eats.store.orders.restaurantdelivery.status"
    ]);
  }

  private buildStoreStatusUrl(storeId: string): string {
    const customPath = process.env.UBER_STORE_STATUS_PATH;

    if (customPath && customPath.trim().length > 0) {
      const normalizedPath = customPath
        .replace(":storeId", storeId)
        .replace("{store_id}", storeId)
        .replace("{storeId}", storeId);

      const finalPath = normalizedPath.startsWith("/")
        ? normalizedPath
        : `/${normalizedPath}`;

      return `${this.apiBaseUrl}${finalPath}`;
    }

    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/status`;
  }

  public async testStoreStatusWriteScope(): Promise<{
    scope: string;
    token_obtained: boolean;
  }> {
    await this.getStoreStatusWriteToken();

    return {
      scope: "eats.store.status.write",
      token_obtained: true
    };
  }

  public async testStoreStatusReadScope(): Promise<{
    scope: string;
    token_obtained: boolean;
  }> {
    await this.getStoreStatusReadToken();

    return {
      scope: "eats.store.status.read",
      token_obtained: true
    };
  }

  public async testRestaurantDeliveryStatusScope(): Promise<{
    scope: string;
    token_obtained: boolean;
  }> {
    await this.getRestaurantDeliveryStatusToken();

    return {
      scope: "eats.store.orders.restaurantdelivery.status",
      token_obtained: true
    };
  }

  public async getStoreStatus(storeId: string): Promise<unknown> {
    const token = await this.getStoreStatusReadToken();
    const requestUrl = this.buildStoreStatusUrl(storeId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE GET STORE STATUS"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("scope: eats.store.status.read"));

      const response = await this.http.get(requestUrl, {
        headers: this.getAuthHeaders(token),
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Status obtenido correctamente para store ${storeId}`));

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener el status de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener el status de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async updateStoreStatus(
    storeId: string,
    payload: UberStoreStatusPayload
  ): Promise<unknown> {
    const token = await this.getStoreStatusWriteToken();
    const requestUrl = this.buildStoreStatusUrl(storeId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE UPDATE STORE STATUS"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("scope: eats.store.status.write"));
      console.log(chalk.cyan("payload status hacia Uber:"));
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.http.put(requestUrl, payload, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Status actualizado correctamente para store ${storeId}`));

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible actualizar el status de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible actualizar el status de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }
}

let uberStoreStatusServiceInstance: UberStoreStatusService | null = null;

export function getUberStoreStatusService(): UberStoreStatusService {
  if (!uberStoreStatusServiceInstance) {
    uberStoreStatusServiceInstance = new UberStoreStatusService();
  }

  return uberStoreStatusServiceInstance;
}