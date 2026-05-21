import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import {
  UberGetHolidayHoursResponse,
  UberUpdateHolidayHoursRequest
} from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export class UberStoreService {
  private readonly apiBaseUrl: string;
  private readonly http: AxiosInstance;

  constructor() {
    // FIX: Usar api.uber.com en producción, no test-api.uber.com
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

  private buildHolidayHoursUrl(storeId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/holiday-hours`;
  }

  private async getStoreScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken(["eats.store"]);
  }

  public async getHolidayHours(storeId: string): Promise<UberGetHolidayHoursResponse> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildHolidayHoursUrl(storeId);

    try {
      const response = await this.http.get<UberGetHolidayHoursResponse>(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log(chalk.green(`✓ Holiday hours obtenidos correctamente para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener los holiday hours de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener los holiday hours de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async updateHolidayHours(
    storeId: string,
    payload: UberUpdateHolidayHoursRequest
  ): Promise<void> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildHolidayHoursUrl(storeId);

    try {
      await this.http.post(requestUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Holiday hours actualizados correctamente para store ${storeId}`));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible actualizar los holiday hours de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible actualizar los holiday hours de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }
}

let uberStoreServiceInstance: UberStoreService | null = null;

export function getUberStoreService(): UberStoreService {
  if (!uberStoreServiceInstance) {
    uberStoreServiceInstance = new UberStoreService();
  }

  return uberStoreServiceInstance;
}