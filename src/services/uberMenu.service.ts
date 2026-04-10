import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import {
  UberGetMenuResponse,
  UberMenuConfiguration,
  UberMenuType,
  UberUpdateMenuItemRequest
} from "../types/uber";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export class UberMenuService {
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

  private buildMenuUrl(storeId: string, menuType?: UberMenuType): string {
    const params = new URLSearchParams();

    if (menuType) {
      params.append("menu_type", menuType);
    }

    const query = params.toString();

    return `${this.apiBaseUrl}/v2/eats/stores/${storeId}/menus${query ? `?${query}` : ""}`;
  }

  private buildUpdateItemUrl(storeId: string, itemId: string): string {
    return `${this.apiBaseUrl}/v2/eats/stores/${storeId}/menus/items/${itemId}`;
  }

  private async getStoreScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken(["eats.store"]);
  }

  public async getMenu(
    storeId: string,
    menuType?: UberMenuType
  ): Promise<UberGetMenuResponse> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildMenuUrl(storeId, menuType);

    try {
      const response = await this.http.get<UberGetMenuResponse>(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log(chalk.green(`✓ Menú obtenido correctamente para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener el menú de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener el menú de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async uploadMenu(
    storeId: string,
    payload: UberMenuConfiguration
  ): Promise<void> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildMenuUrl(storeId, payload.menu_type);

    try {
      await this.http.put(requestUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Menú cargado correctamente para store ${storeId}`));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible cargar el menú de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible cargar el menú de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async updateItem(
    storeId: string,
    itemId: string,
    payload: UberUpdateMenuItemRequest
  ): Promise<void> {
    const token = await this.getStoreScopedToken();
    const requestUrl = this.buildUpdateItemUrl(storeId, itemId);

    try {
      await this.http.post(requestUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Item ${itemId} actualizado correctamente en store ${storeId}`));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible actualizar el item ${itemId} de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible actualizar el item ${itemId} de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }
}

let uberMenuServiceInstance: UberMenuService | null = null;

export function getUberMenuService(): UberMenuService {
  if (!uberMenuServiceInstance) {
    uberMenuServiceInstance = new UberMenuService();
  }

  return uberMenuServiceInstance;
}