import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import {
  UberStoreIntegrationDetails,
  UberUpdateStoreIntegrationRequest
} from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

type IntegrationRawData = Record<string, unknown>;

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

  private buildStorePosDataUrl(storeId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/pos_data`;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  private mapIntegrationDetails(storeId: string, raw: unknown): UberStoreIntegrationDetails {
    const data: IntegrationRawData = this.isObject(raw) ? raw : {};

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

  private async getAppToken(scopes: string[] = ["eats.store"]): Promise<string> {
    return getUberAppTokenService().getAccessToken(scopes);
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

    if (responseData && typeof responseData === "object" && "message" in responseData) {
      message = String((responseData as { message: unknown }).message);
    } else if (responseData && typeof responseData === "object" && "error" in responseData) {
      message = String((responseData as { error: unknown }).error);
    } else if (error.message) {
      message = error.message;
    }

    return new UberApiRequestError(message, statusCode, responseData, "uber", requestUrl);
  }

  public async getStoreIntegrationDetails(storeId: string): Promise<UberStoreIntegrationDetails> {
    const token = await this.getAppToken(["eats.store"]);
    const requestUrl = this.buildStorePosDataUrl(storeId);

    try {
      const response = await this.http.get(requestUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(chalk.green(`✓ Detalle de integración obtenido para store ${storeId}`));
      return this.mapIntegrationDetails(storeId, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener detalle de integración de ${storeId}`,
          requestUrl
        );
      }
      throw error;
    }
  }

  public async updateStoreIntegration(
    storeId: string,
    payload: UberUpdateStoreIntegrationRequest
  ): Promise<void> {
    const token = await this.getAppToken(["eats.store"]);
    const requestUrl = this.buildStorePosDataUrl(storeId);

    const body: Record<string, unknown> = {};

    if (typeof (payload as any).integration_enabled === "boolean") {
      body.integration_enabled = (payload as any).integration_enabled;
    }

    if (typeof payload.is_order_manager === "boolean") {
      body.is_order_manager = payload.is_order_manager;
    }

    if (payload.integrator_store_id?.trim()) {
      body.integrator_store_id = payload.integrator_store_id.trim();
    }

    if (payload.integrator_brand_id?.trim()) {
      body.integrator_brand_id = payload.integrator_brand_id.trim();
    }

    if ((payload as any).store_configuration_data != null) {
      const raw = (payload as any).store_configuration_data;
      body.store_configuration_data =
        typeof raw === "string" ? raw : JSON.stringify(raw);
    }

    try {
      await this.http.patch(requestUrl, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Integración actualizada correctamente para store ${storeId}`));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible actualizar integración de ${storeId}`,
          requestUrl
        );
      }
      throw error;
    }
  }

  public async removeStoreIntegration(storeId: string): Promise<unknown> {
    const token = await this.getAppToken(["eats.store"]);
    const requestUrl = this.buildStorePosDataUrl(storeId);

    try {
      const response = await this.http.delete(requestUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(chalk.green(`✓ Integración removida correctamente para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible remover integración de ${storeId}`,
          requestUrl
        );
      }
      throw error;
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