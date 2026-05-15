import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export type UberPromotionType =
  | "FLAT_OFF"
  | "FREE_ITEM_MIN_BASKET"
  | "PERCENT_OFF"
  | "BOGO"
  | string;

export interface UberPromotionCreatePayload extends Record<string, unknown> {
  promotion_type?: UberPromotionType;
}

export interface UberPromotionListQuery {
  status?: string;
  page_size?: number;
  page_token?: string;
}

export class UberPromotionsService {
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

  private async getPromotionsReadToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken([
      "eats.store.promotions.read"
    ]);
  }

  private async getPromotionsWriteToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken([
      "eats.store.promotions.write"
    ]);
  }

  private getAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  private buildStorePromotionsUrl(storeId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/promotions`;
  }

  private buildStorePromotionDetailsUrl(storeId: string, promotionId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/promotions/${promotionId}`;
  }

  private buildStorePromotionRevokeUrl(storeId: string, promotionId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/promotions/${promotionId}/revoke`;
  }

  public async createStorePromotion(
    storeId: string,
    payload: UberPromotionCreatePayload
  ): Promise<unknown> {
    const token = await this.getPromotionsWriteToken();
    const requestUrl = this.buildStorePromotionsUrl(storeId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE CREATE STORE PROMOTION"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("payload promotion hacia Uber:"));
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.http.post(requestUrl, payload, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Promoción creada correctamente para store ${storeId}`));

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible crear la promoción de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible crear la promoción de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async listStorePromotions(
    storeId: string,
    query?: UberPromotionListQuery
  ): Promise<unknown> {
    const token = await this.getPromotionsReadToken();
    const requestUrl = this.buildStorePromotionsUrl(storeId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE LIST STORE PROMOTIONS"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan(`query: ${JSON.stringify(query ?? {}, null, 2)}`));

      const response = await this.http.get(requestUrl, {
        headers: this.getAuthHeaders(token),
        params: query ?? {},
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(chalk.green(`✓ Promociones obtenidas correctamente para store ${storeId}`));

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener las promociones de la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener las promociones de la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async getStorePromotionDetails(
    storeId: string,
    promotionId: string
  ): Promise<unknown> {
    const token = await this.getPromotionsReadToken();
    const requestUrl = this.buildStorePromotionDetailsUrl(storeId, promotionId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE GET STORE PROMOTION DETAILS"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));

      const response = await this.http.get(requestUrl, {
        headers: this.getAuthHeaders(token),
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(
        chalk.green(`✓ Detalle de promoción obtenido correctamente ${promotionId}`)
      );

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener el detalle de la promoción ${promotionId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener el detalle de la promoción ${promotionId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async revokeStorePromotion(
    storeId: string,
    promotionId: string,
    payload?: Record<string, unknown>
  ): Promise<unknown> {
    const token = await this.getPromotionsWriteToken();
    const requestUrl = this.buildStorePromotionRevokeUrl(storeId, promotionId);

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE REVOKE STORE PROMOTION"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("payload revoke promotion hacia Uber:"));
      console.log(JSON.stringify(payload ?? {}, null, 2));

      const response = await this.http.post(requestUrl, payload ?? {}, {
        headers: {
          ...this.getAuthHeaders(token),
          "Content-Type": "application/json"
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      console.log(
        chalk.green(`✓ Promoción revocada correctamente ${promotionId}`)
      );

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible revocar la promoción ${promotionId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible revocar la promoción ${promotionId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }
}

let uberPromotionsServiceInstance: UberPromotionsService | null = null;

export function getUberPromotionsService(): UberPromotionsService {
  if (!uberPromotionsServiceInstance) {
    uberPromotionsServiceInstance = new UberPromotionsService();
  }

  return uberPromotionsServiceInstance;
}