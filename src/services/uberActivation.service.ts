import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import {
  UberActivateStoreRequest,
  UberOAuthTokenResponse,
  UberStore,
  UberStoreIntegrationDetails,
  UberUpdateStoreIntegrationRequest
} from "../types/uber";
import { getUberIntegrationService } from "./uberIntegration.service";

export class UberApiRequestError extends Error {
  public readonly statusCode: number;
  public readonly details: unknown;
  public readonly source: string;
  public readonly requestUrl?: string;

  constructor(
    message: string,
    statusCode = 500,
    details: unknown = null,
    source = "uber",
    requestUrl?: string
  ) {
    super(message);
    this.name = "UberApiRequestError";
    this.statusCode = statusCode;
    this.details = details;
    this.source = source;
    this.requestUrl = requestUrl;
  }
}

type IntegrationRawData = Record<string, unknown>;

export class UberActivationService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly apiBaseUrl: string;
  private readonly authBaseUrl: string;
  private readonly http: AxiosInstance;

  constructor() {
    const clientId = process.env.UBER_CLIENT_ID;
    const clientSecret = process.env.UBER_CLIENT_SECRET;
    const redirectUri = process.env.UBER_REDIRECT_URI;
    const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";
    const authBaseUrl = process.env.UBER_AUTH_BASE_URL || "https://sandbox-login.uber.com";

    if (!clientId) throw new Error("Falta la variable de entorno UBER_CLIENT_ID");
    if (!clientSecret) throw new Error("Falta la variable de entorno UBER_CLIENT_SECRET");
    if (!redirectUri) throw new Error("Falta la variable de entorno UBER_REDIRECT_URI");

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
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
      message = (responseData as { message: string }).message;
    } else if (responseData && typeof responseData === "object" && "error" in responseData) {
      message = (responseData as { error: string }).error;
    } else if (error.message) {
      message = error.message;
    }

    return new UberApiRequestError(message, statusCode, responseData, "uber", requestUrl);
  }

  private buildStorePosDataUrl(
    storeId: string,
    payload?: UberActivateStoreRequest | UberUpdateStoreIntegrationRequest
  ): string {
    const params = new URLSearchParams();

    if (typeof payload?.is_order_manager === "boolean") {
      params.append("is_order_manager", String(payload.is_order_manager));
    }
    if (typeof payload?.integrator_store_id === "string" && payload.integrator_store_id.trim()) {
      params.append("integrator_store_id", payload.integrator_store_id.trim());
    }
    if (typeof payload?.integrator_brand_id === "string" && payload.integrator_brand_id.trim()) {
      params.append("integrator_brand_id", payload.integrator_brand_id.trim());
    }
    if (typeof payload?.merchant_store_id === "string" && payload.merchant_store_id.trim()) {
      params.append("merchant_store_id", payload.merchant_store_id.trim());
    }

    const queryString = params.toString();
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/pos_data${queryString ? `?${queryString}` : ""}`;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  private mapIntegrationDetails(storeId: string, raw: unknown): UberStoreIntegrationDetails {
    const data: IntegrationRawData = this.isObject(raw) ? raw : {};

    const integrationEnabled =
      typeof data.integration_enabled === "boolean"
        ? data.integration_enabled
        : typeof data.pos_integration_enabled === "boolean"
          ? data.pos_integration_enabled
          : undefined;

    return {
      store_id: storeId,
      is_order_manager: typeof data.is_order_manager === "boolean" ? data.is_order_manager : undefined,
      integrator_store_id: typeof data.integrator_store_id === "string" ? data.integrator_store_id : null,
      integrator_brand_id: typeof data.integrator_brand_id === "string" ? data.integrator_brand_id : null,
      merchant_store_id: typeof data.merchant_store_id === "string" ? data.merchant_store_id : null,
      integration_enabled: integrationEnabled,
      raw
    };
  }

  private printIntegrationSnapshot(title: string, storeId: string, raw: unknown): void {
    const data: IntegrationRawData = this.isObject(raw) ? raw : {};

    console.log(chalk.blue("========================================================"));
    console.log(chalk.blue(title));
    console.log(chalk.blue(`Store ID: ${storeId}`));
    console.log(chalk.blue(`integration_enabled: ${typeof data.integration_enabled === "boolean" ? data.integration_enabled : "N/A"}`));
    console.log(chalk.blue(`pos_integration_enabled: ${typeof data.pos_integration_enabled === "boolean" ? data.pos_integration_enabled : "N/A"}`));
    console.log(chalk.blue(`order_release_enabled: ${typeof data.order_release_enabled === "boolean" ? data.order_release_enabled : "N/A"}`));
    console.log(chalk.blue(`integrator_store_id: ${typeof data.integrator_store_id === "string" ? data.integrator_store_id : "N/A"}`));
    console.log(chalk.blue(`integrator_brand_id: ${typeof data.integrator_brand_id === "string" ? data.integrator_brand_id : "N/A"}`));
    console.log(chalk.blue(`merchant_store_id: ${typeof data.merchant_store_id === "string" ? data.merchant_store_id : "N/A"}`));
    console.log(chalk.blue("========================================================"));
  }

  private printActivationWarnings(storeId: string, raw: unknown): void {
    const data: IntegrationRawData = this.isObject(raw) ? raw : {};
    const warnings: string[] = [];

    if (data.pos_integration_enabled !== true) warnings.push("pos_integration_enabled sigue en false");
    if (data.order_release_enabled !== true) warnings.push("order_release_enabled sigue en false");
    if (typeof data.integrator_store_id !== "string" || !data.integrator_store_id.trim()) warnings.push("integrator_store_id vacío");
    if (typeof data.integrator_brand_id !== "string" || !data.integrator_brand_id.trim()) warnings.push("integrator_brand_id vacío");

    if (warnings.length === 0) {
      console.log(chalk.green(`✓ Integración POS parece habilitada correctamente para store ${storeId}`));
      return;
    }

    console.log(chalk.yellow(`⚠ Store ${storeId} activada pero estado incompleto`));
    warnings.forEach(w => console.log(chalk.yellow(`- ${w}`)));
  }

  private async fetchRawStoreIntegrationDetails(accessToken: string, storeId: string): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId);
    const response = await this.http.get(requestUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.data;
  }

  public buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", this.redirectUri);
    params.append("scope", "eats.pos_provisioning offline_access");
    params.append("state", state);
    return `${this.authBaseUrl}/oauth/v2/authorize?${params.toString()}`;
  }

  public async exchangeCodeForToken(code: string): Promise<UberOAuthTokenResponse> {
    const form = new URLSearchParams();
    form.append("client_id", this.clientId);
    form.append("client_secret", this.clientSecret);
    form.append("grant_type", "authorization_code");
    form.append("redirect_uri", this.redirectUri);
    form.append("code", code);

    const requestUrl = `${this.authBaseUrl}/oauth/v2/token`;

    try {
      const response = await this.http.post<UberOAuthTokenResponse>(requestUrl, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      console.log(chalk.green("✓ Token merchant OAuth obtenido correctamente"));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) throw this.buildAxiosError(error, "No fue posible intercambiar el code por el token merchant", requestUrl);
      throw new UberApiRequestError("No fue posible intercambiar el code por el token merchant", 500, null, "server", requestUrl);
    }
  }

  public async getMerchantStores(accessToken: string): Promise<UberStore[]> {
    const requestUrl = `${this.apiBaseUrl}/v1/eats/stores`;
    try {
      const response = await this.http.get(requestUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.stores)) return raw.stores;
      if (Array.isArray(raw?.data)) return raw.data;
      return [];
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) throw this.buildAxiosError(error, "No fue posible obtener las stores del merchant", requestUrl);
      throw new UberApiRequestError("No fue posible obtener las stores del merchant", 500, null, "server", requestUrl);
    }
  }

  public async activateStore(
    accessToken: string,
    storeId: string,
    payload: UberActivateStoreRequest
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId, payload);

    console.log(chalk.blue("========================================================"));
    console.log(chalk.blue("ACTIVATE STORE - REQUEST"));
    console.log(chalk.blue(`Store ID: ${storeId}`));
    console.log(chalk.blue(`URL: ${requestUrl}`));
    console.log(chalk.blue(`Payload: ${JSON.stringify(payload, null, 2)}`));
    console.log(chalk.blue("========================================================"));

    // Estado previo
    let beforeIntegrationRaw: unknown = null;
    try {
      beforeIntegrationRaw = await this.fetchRawStoreIntegrationDetails(accessToken, storeId);
      this.printIntegrationSnapshot("ESTADO ANTES DE ACTIVATE", storeId, beforeIntegrationRaw);
    } catch (beforeError: unknown) {
      console.log(chalk.yellow(`⚠ No se pudo consultar estado previo para store ${storeId}`));
    }

    // Activación con token del merchant
    const response = await this.http.post(requestUrl, {}, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    console.log(chalk.green(`✓ Store ${storeId} activada correctamente`));

    // === FIX PRINCIPAL: Forzar actualización con eats.store scope ===
    try {
      const integrationService = getUberIntegrationService();
      const updatePayload: UberUpdateStoreIntegrationRequest = {
        is_order_manager: payload.is_order_manager,
        integrator_store_id: payload.integrator_store_id,
        integrator_brand_id: payload.integrator_brand_id,
        merchant_store_id: payload.merchant_store_id
      };

      await integrationService.updateStoreIntegration(storeId, updatePayload);
      console.log(chalk.green(`✓ Forzado update con eats.store scope (IDs y order_release)`));
    } catch (updateError: unknown) {
      console.warn(chalk.yellow("⚠ No se pudo forzar el update con eats.store (posiblemente necesites soporte de Uber)"));
    }
    // === FIN FIX ===

    // Verificación final
    try {
      const afterIntegrationRaw = await this.fetchRawStoreIntegrationDetails(accessToken, storeId);
      this.printIntegrationSnapshot("ESTADO DESPUÉS DE ACTIVATE", storeId, afterIntegrationRaw);
      this.printActivationWarnings(storeId, afterIntegrationRaw);

      return {
        activation_response: response.data ?? {},
        verification: this.mapIntegrationDetails(storeId, afterIntegrationRaw)
      };
    } catch (afterError: unknown) {
      console.log(chalk.yellow(`⚠ No se pudo verificar estado posterior para store ${storeId}`));
      return {
        activation_response: response.data ?? {},
        verification: null
      };
    }
  }

  // Mantengo los métodos restantes tal como los tenías (solo eliminé duplicados innecesarios de logging)
  public async getStoreIntegrationDetails(accessToken: string, storeId: string): Promise<UberStoreIntegrationDetails> {
    const requestUrl = this.buildStorePosDataUrl(storeId);
    try {
      const response = await this.http.get(requestUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      console.log(chalk.green(`✓ Detalles de integración obtenidos para store ${storeId}`));
      this.printIntegrationSnapshot("CONSULTA DE DETALLE DE INTEGRACIÓN", storeId, response.data);
      return this.mapIntegrationDetails(storeId, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) throw this.buildAxiosError(error, `No fue posible obtener detalle de integración de ${storeId}`, requestUrl);
      throw new UberApiRequestError(`No fue posible obtener detalle de integración de ${storeId}`, 500, null, "server", requestUrl);
    }
  }

  public async updateStoreIntegration(
    accessToken: string,
    storeId: string,
    payload: UberUpdateStoreIntegrationRequest
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId, payload);
    try {
      const response = await this.http.put(requestUrl, {}, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
      });
      console.log(chalk.green(`✓ Integración actualizada para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) throw this.buildAxiosError(error, `No fue posible actualizar integración de ${storeId}`, requestUrl);
      throw new UberApiRequestError(`No fue posible actualizar integración de ${storeId}`, 500, null, "server", requestUrl);
    }
  }

  public async removeStoreIntegration(accessToken: string, storeId: string): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId);
    try {
      const response = await this.http.delete(requestUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      console.log(chalk.green(`✓ Integración removida para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) throw this.buildAxiosError(error, `No fue posible remover integración de ${storeId}`, requestUrl);
      throw new UberApiRequestError(`No fue posible remover integración de ${storeId}`, 500, null, "server", requestUrl);
    }
  }
}

let uberActivationServiceInstance: UberActivationService | null = null;

export function getUberActivationService(): UberActivationService {
  if (!uberActivationServiceInstance) {
    uberActivationServiceInstance = new UberActivationService();
  }
  return uberActivationServiceInstance;
}