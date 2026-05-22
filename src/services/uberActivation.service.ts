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

  /**
   * authBaseUrl — usado para el OAuth authorize redirect (paso 2 del flujo).
   *
   * Sandbox:    https://sandbox-login.uber.com  (se mantiene para Test App)
   * Producción: https://login.uber.com
   *
   * Variable de entorno: UBER_AUTH_BASE_URL
   */
  private readonly authBaseUrl: string;

  /**
   * tokenBaseUrl — usado SOLO para el token exchange (paso 4 del flujo).
   *
   * La documentación oficial de Uber especifica:
   *   POST https://auth.uber.com/oauth/v2/token
   *
   * Esto es diferente al authorize URL. Uber registra los token exchanges
   * en su sistema de validación solo cuando se usan contra auth.uber.com.
   *
   * Variable de entorno: UBER_TOKEN_BASE_URL
   * Fallback: https://auth.uber.com
   */
  private readonly tokenBaseUrl: string;

  private readonly http: AxiosInstance;

  constructor() {
    const clientId = process.env.UBER_CLIENT_ID;
    const clientSecret = process.env.UBER_CLIENT_SECRET;
    const redirectUri = process.env.UBER_REDIRECT_URI;
    const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";
    const authBaseUrl = process.env.UBER_AUTH_BASE_URL || "https://sandbox-login.uber.com";

    // FIX: El token exchange debe ir a auth.uber.com (documentación oficial),
    // no a sandbox-login.uber.com. Uber registra los Auth Code Flow completions
    // solo cuando el token exchange llega a auth.uber.com.
    const tokenBaseUrl = process.env.UBER_TOKEN_BASE_URL || "https://auth.uber.com";

    if (!clientId) throw new Error("Falta la variable de entorno UBER_CLIENT_ID");
    if (!clientSecret) throw new Error("Falta la variable de entorno UBER_CLIENT_SECRET");
    if (!redirectUri) throw new Error("Falta la variable de entorno UBER_REDIRECT_URI");

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    this.authBaseUrl = authBaseUrl.replace(/\/+$/, "");
    this.tokenBaseUrl = tokenBaseUrl.replace(/\/+$/, "");

    this.http = axios.create({
      timeout: 20000,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip"
      }
    });

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("UberActivationService inicializado"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`apiBaseUrl:   ${this.apiBaseUrl}`));
    console.log(chalk.cyan(`authBaseUrl:  ${this.authBaseUrl}`));
    console.log(chalk.cyan(`tokenBaseUrl: ${this.tokenBaseUrl}`));
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

  private buildStorePosDataUrl(storeId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/pos_data`;
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
      is_order_manager:
        typeof data.is_order_manager === "boolean" ? data.is_order_manager : undefined,
      integrator_store_id:
        typeof data.integrator_store_id === "string" ? data.integrator_store_id : null,
      integrator_brand_id:
        typeof data.integrator_brand_id === "string" ? data.integrator_brand_id : null,
      merchant_store_id:
        typeof data.merchant_store_id === "string" ? data.merchant_store_id : null,
      integration_enabled: integrationEnabled,
      raw
    };
  }

  private printIntegrationSnapshot(title: string, storeId: string, raw: unknown): void {
    const data: IntegrationRawData = this.isObject(raw) ? raw : {};

    console.log(chalk.blue("========================================================"));
    console.log(chalk.blue(title));
    console.log(chalk.blue(`Store ID: ${storeId}`));
    console.log(
      chalk.blue(
        `integration_enabled: ${
          typeof data.integration_enabled === "boolean" ? data.integration_enabled : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `pos_integration_enabled: ${
          typeof data.pos_integration_enabled === "boolean"
            ? data.pos_integration_enabled
            : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `order_release_enabled: ${
          typeof data.order_release_enabled === "boolean"
            ? data.order_release_enabled
            : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `integrator_store_id: ${
          typeof data.integrator_store_id === "string" ? data.integrator_store_id : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `integrator_brand_id: ${
          typeof data.integrator_brand_id === "string" ? data.integrator_brand_id : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `merchant_store_id: ${
          typeof data.merchant_store_id === "string" ? data.merchant_store_id : "N/A"
        }`
      )
    );
    console.log(chalk.blue("========================================================"));
  }

  private buildActivateQueryParams(payload: UberActivateStoreRequest): URLSearchParams {
    const params = new URLSearchParams();

    if (typeof payload.is_order_manager === "boolean") {
      params.set("is_order_manager", String(payload.is_order_manager));
    }

    if (payload.integrator_store_id?.trim()) {
      params.set("integrator_store_id", payload.integrator_store_id.trim());
    }

    if (payload.integrator_brand_id?.trim()) {
      params.set("integrator_brand_id", payload.integrator_brand_id.trim());
    }

    if (payload.merchant_store_id?.trim()) {
      params.set("merchant_store_id", payload.merchant_store_id.trim());
    }

    if ((payload as Record<string, unknown>).store_configuration_data != null) {
      const raw = (payload as Record<string, unknown>).store_configuration_data;
      params.set(
        "store_configuration_data",
        typeof raw === "string" ? raw : JSON.stringify(raw)
      );
    }

    return params;
  }

  /**
   * buildAuthorizationUrl
   *
   * Construye la URL de autorización OAuth para redirigir al merchant.
   * Usa authBaseUrl (sandbox-login.uber.com para Test App).
   *
   * Según el diagrama de Uber:
   * Step 2: POST https://login.uber.com/oauth/v2/authorize
   */
  public buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", this.redirectUri);
    params.append("scope", "eats.pos_provisioning offline_access");
    params.append("state", state);

    const url = `${this.authBaseUrl}/oauth/v2/authorize?${params.toString()}`;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG BUILD AUTHORIZATION URL"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`authBaseUrl: ${this.authBaseUrl}`));
    console.log(chalk.cyan(`url: ${url}`));

    return url;
  }

  /**
   * exchangeCodeForToken
   *
   * Intercambia el authorization_code por un access_token.
   *
   * FIX CRÍTICO: Usa tokenBaseUrl (auth.uber.com) en lugar de authBaseUrl.
   *
   * Según el diagrama oficial de Uber:
   * Step 4: POST https://auth.uber.com/oauth/v2/token
   *
   * Uber registra los Auth Code Flow completions en su sistema de validación
   * SOLO cuando el token exchange llega a auth.uber.com. Si se usa
   * sandbox-login.uber.com para el token exchange, Uber no lo registra
   * como "Authorizations Completed" en el Access Tokens dashboard,
   * lo que impide que pase la validación de producción.
   */
  public async exchangeCodeForToken(code: string): Promise<UberOAuthTokenResponse> {
    const form = new URLSearchParams();
    form.append("client_id", this.clientId);
    form.append("client_secret", this.clientSecret);
    form.append("grant_type", "authorization_code");
    form.append("redirect_uri", this.redirectUri);
    form.append("code", code);

    // FIX: tokenBaseUrl = auth.uber.com, NO authBaseUrl = sandbox-login.uber.com
    const requestUrl = `${this.tokenBaseUrl}/oauth/v2/token`;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG EXCHANGE CODE FOR TOKEN"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`tokenBaseUrl: ${this.tokenBaseUrl}`));
    console.log(chalk.cyan(`requestUrl: ${requestUrl}`));

    try {
      const response = await this.http.post<UberOAuthTokenResponse>(requestUrl, form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });

      console.log(chalk.green("✓ Token merchant OAuth obtenido correctamente"));
      console.log(chalk.green(`scope: ${response.data.scope ?? "N/A"}`));
      console.log(chalk.green(`expires_in: ${response.data.expires_in ?? "N/A"}`));

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          "No fue posible intercambiar el code por el token merchant",
          requestUrl
        );
      }

      throw new UberApiRequestError(
        "No fue posible intercambiar el code por el token merchant",
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async getMerchantStores(accessToken: string): Promise<UberStore[]> {
    const requestUrl = `${this.apiBaseUrl}/v1/eats/stores`;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG GET MERCHANT STORES"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`requestUrl: ${requestUrl}`));

    try {
      const response = await this.http.get(requestUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const raw = response.data;

      console.log(chalk.green(`✓ Stores obtenidas correctamente`));

      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.stores)) return raw.stores;
      if (Array.isArray(raw?.data)) return raw.data;

      return [];
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          "No fue posible obtener las stores del merchant",
          requestUrl
        );
      }

      throw new UberApiRequestError(
        "No fue posible obtener las stores del merchant",
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async activateStore(
    merchantAccessToken: string,
    storeId: string,
    payload: UberActivateStoreRequest
  ): Promise<unknown> {
    const baseUrl = this.buildStorePosDataUrl(storeId);
    const params = this.buildActivateQueryParams(payload);
    const requestUrl = `${baseUrl}${params.toString() ? `?${params.toString()}` : ""}`;

    console.log(chalk.blue("========================================================"));
    console.log(chalk.blue("ACTIVATE STORE - REQUEST"));
    console.log(chalk.blue(`Store ID: ${storeId}`));
    console.log(chalk.blue(`URL: ${requestUrl}`));
    console.log(chalk.blue(`Payload lógico: ${JSON.stringify(payload, null, 2)}`));
    console.log(chalk.blue("========================================================"));

    try {
      const response = await this.http.post(
        requestUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${merchantAccessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(
        chalk.green(
          `✓ Solicitud de activación enviada correctamente para store ${storeId}`
        )
      );

      let verification: UberStoreIntegrationDetails | null = null;
      let verificationError: string | null = null;

      try {
        const integrationService = getUberIntegrationService();
        verification = await integrationService.getStoreIntegrationDetails(storeId);
        this.printIntegrationSnapshot(
          "ESTADO DESPUÉS DE ACTIVATE (APP TOKEN)",
          storeId,
          verification.raw
        );
      } catch (error: unknown) {
        verificationError =
          error instanceof Error ? error.message : "No fue posible verificar con app token";
        console.log(
          chalk.yellow(
            "⚠ La activación fue aceptada, pero todavía no se pudo confirmar con GET /pos_data usando eats.store. " +
              "Esto puede significar que la store sigue pendiente de provisionamiento."
          )
        );
      }

      return {
        activation_response: response.data ?? {},
        verification,
        pending_provisioning: verification == null,
        verification_error: verificationError
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible activar la store ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible activar la store ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async getStoreIntegrationDetails(
    accessToken: string,
    storeId: string
  ): Promise<UberStoreIntegrationDetails> {
    const requestUrl = this.buildStorePosDataUrl(storeId);

    try {
      const response = await this.http.get(requestUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      console.log(chalk.green(`✓ Detalles de integración obtenidos para store ${storeId}`));
      this.printIntegrationSnapshot(
        "CONSULTA DE DETALLE DE INTEGRACIÓN",
        storeId,
        response.data
      );

      return this.mapIntegrationDetails(storeId, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible obtener detalle de integración de ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible obtener detalle de integración de ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async updateStoreIntegration(
    accessToken: string,
    storeId: string,
    payload: UberUpdateStoreIntegrationRequest
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId);

    const body: Record<string, unknown> = {};

    if (typeof (payload as Record<string, unknown>).integration_enabled === "boolean") {
      body.integration_enabled = (payload as Record<string, unknown>).integration_enabled;
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

    if ((payload as Record<string, unknown>).store_configuration_data != null) {
      const raw = (payload as Record<string, unknown>).store_configuration_data;
      body.store_configuration_data =
        typeof raw === "string" ? raw : JSON.stringify(raw);
    }

    try {
      const response = await this.http.patch(requestUrl, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });

      console.log(chalk.green(`✓ Integración actualizada para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible actualizar integración de ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible actualizar integración de ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
    }
  }

  public async removeStoreIntegration(
    accessToken: string,
    storeId: string
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId);

    try {
      const response = await this.http.delete(requestUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      console.log(chalk.green(`✓ Integración removida para store ${storeId}`));
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          `No fue posible remover integración de ${storeId}`,
          requestUrl
        );
      }

      throw new UberApiRequestError(
        `No fue posible remover integración de ${storeId}`,
        500,
        null,
        "server",
        requestUrl
      );
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