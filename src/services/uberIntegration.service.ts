import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import {
  UberStoreIntegrationDetails,
  UberUpdateStoreIntegrationRequest
} from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export class UberIntegrationService {
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

  private buildStorePosDataUrl(
    storeId: string,
    payload?: UberUpdateStoreIntegrationRequest
  ): string {
    const params = new URLSearchParams();

    if (typeof payload?.is_order_manager === "boolean") {
      params.append("is_order_manager", String(payload.is_order_manager));
    }

    if (payload?.integrator_store_id) {
      params.append("integrator_store_id", payload.integrator_store_id);
    }

    if (payload?.integrator_brand_id) {
      params.append("integrator_brand_id", payload.integrator_brand_id);
    }

    if (payload?.merchant_store_id) {
      params.append("merchant_store_id", payload.merchant_store_id);
    }

    const queryString = params.toString();

    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/pos_data${
      queryString ? `?${queryString}` : ""
    }`;
  }

  private mapIntegrationDetails(storeId: string, raw: unknown): UberStoreIntegrationDetails {
    const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

    return {
      store_id: storeId,
      is_order_manager:
        typeof data.is_order_manager === "boolean" ? data.is_order_manager : undefined,
      integrator_store_id:
        typeof data.integrator_store_id === "string" ? data.integrator_store_id : null,
      integrator_brand_id:
        typeof data.integrator_brand_id === "string" ? data.integrator_brand_id : null,
      merchant_store_id:
        typeof data.merchant_store_id === "string" ? data.merchant_store_id : null,
      integration_enabled:
        typeof data.integration_enabled === "boolean"
          ? data.integration_enabled
          : typeof data.pos_integration_enabled === "boolean"
            ? data.pos_integration_enabled
            : undefined,
      raw
    };
  }

  private async getStoreScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken(["eats.store"]);
  }

  public async getStoreIntegrationDetails(storeId: string): Promise<UberStoreIntegrationDetails> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildStorePosDataUrl(storeId);

    try {
      const response = await this.http.get(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log(chalk.green(`✓ Detalle de integración obtenido para store ${storeId}`));

      return this.mapIntegrationDetails(storeId, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener el detalle de integración de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener el detalle de integración de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async updateStoreIntegration(
    storeId: string,
    payload: UberUpdateStoreIntegrationRequest
  ): Promise<unknown> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildStorePosDataUrl(storeId, payload);

    try {
      const response = await this.http.put(
        requestUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Integración actualizada correctamente para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible actualizar la integración de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible actualizar la integración de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async removeStoreIntegration(storeId: string): Promise<unknown> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildStorePosDataUrl(storeId);

    try {
      const response = await this.http.delete(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log(chalk.green(`✓ Integración removida correctamente para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible remover la integración de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible remover la integración de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }
}

let uberIntegrationServiceInstance: UberIntegrationService | null = null;

export function getUberIntegrationService(): UberIntegrationService {
  if (!uberIntegrationServiceInstance) {
    uberIntegrationServiceInstance = new UberIntegrationService();
  }

  return uberIntegrationServiceInstance;
}