import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import {
  UberActivateStoreRequest,
  UberOAuthTokenResponse,
  UberStore,
  UberStoreIntegrationDetails,
  UberUpdateStoreIntegrationRequest
} from "../types/uber";

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

    if (!clientId) {
      throw new Error("Falta la variable de entorno UBER_CLIENT_ID");
    }

    if (!clientSecret) {
      throw new Error("Falta la variable de entorno UBER_CLIENT_SECRET");
    }

    if (!redirectUri) {
      throw new Error("Falta la variable de entorno UBER_REDIRECT_URI");
    }

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

    return `${this.apiBaseUrl}/v1/eats/stores/${storeId}/pos_data${
      queryString ? `?${queryString}` : ""
    }`;
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
          typeof data.pos_integration_enabled === "boolean" ? data.pos_integration_enabled : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `order_release_enabled: ${
          typeof data.order_release_enabled === "boolean" ? data.order_release_enabled : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `is_order_manager: ${
          typeof data.is_order_manager === "boolean" ? data.is_order_manager : "N/A"
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
    console.log(
      chalk.blue(
        `online_status: ${
          typeof data.online_status === "string" ? data.online_status : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `require_manual_acceptance: ${
          typeof data.require_manual_acceptance === "boolean"
            ? data.require_manual_acceptance
            : "N/A"
        }`
      )
    );
    console.log(
      chalk.blue(
        `auto_accept_enabled: ${
          typeof data.auto_accept_enabled === "boolean" ? data.auto_accept_enabled : "N/A"
        }`
      )
    );

    if (this.isObject(data.webhooks_config)) {
      console.log(chalk.blue(`webhooks_config: ${JSON.stringify(data.webhooks_config, null, 2)}`));
    }

    console.log(chalk.blue("========================================================"));
  }

  private printActivationWarnings(storeId: string, raw: unknown): void {
    const data: IntegrationRawData = this.isObject(raw) ? raw : {};

    const posIntegrationEnabled = data.pos_integration_enabled;
    const orderReleaseEnabled = data.order_release_enabled;
    const integratorStoreId = data.integrator_store_id;
    const integratorBrandId = data.integrator_brand_id;

    const warnings: string[] = [];

    if (posIntegrationEnabled !== true) {
      warnings.push("pos_integration_enabled sigue en false o no viene informado");
    }

    if (orderReleaseEnabled !== true) {
      warnings.push("order_release_enabled sigue en false o no viene informado");
    }

    if (typeof integratorStoreId !== "string" || !integratorStoreId.trim()) {
      warnings.push("integrator_store_id sigue vacío o null");
    }

    if (typeof integratorBrandId !== "string" || !integratorBrandId.trim()) {
      warnings.push("integrator_brand_id sigue vacío o null");
    }

    if (warnings.length === 0) {
      console.log(
        chalk.green(
          `✓ Verificación posterior a activación OK para store ${storeId}: la integración POS parece habilitada`
        )
      );
      return;
    }

    console.log(
      chalk.yellow(
        `⚠ La store ${storeId} respondió a activate, pero el estado real aún no refleja una integración POS completa`
      )
    );

    for (const warning of warnings) {
      console.log(chalk.yellow(`- ${warning}`));
    }
  }

  private async fetchRawStoreIntegrationDetails(
    accessToken: string,
    storeId: string
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId);

    const response = await this.http.get(requestUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
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
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      console.log(chalk.green("✓ Token merchant OAuth obtenido correctamente"));
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

    try {
      const response = await this.http.get(requestUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const raw = response.data;

      if (Array.isArray(raw)) {
        return raw as UberStore[];
      }

      if (Array.isArray(raw?.stores)) {
        return raw.stores as UberStore[];
      }

      if (Array.isArray(raw?.data)) {
        return raw.data as UberStore[];
      }

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
    accessToken: string,
    storeId: string,
    payload: UberActivateStoreRequest
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId, payload);

    try {
      console.log(chalk.blue("========================================================"));
      console.log(chalk.blue("ACTIVATE STORE - REQUEST"));
      console.log(chalk.blue(`Store ID: ${storeId}`));
      console.log(chalk.blue(`Activate URL final: ${requestUrl}`));
      console.log(chalk.blue(`Payload recibido: ${JSON.stringify(payload, null, 2)}`));
      console.log(chalk.blue(`Access token presente: ${accessToken ? "Sí" : "No"}`));
      console.log(chalk.blue("========================================================"));

      let beforeIntegrationRaw: unknown = null;

      try {
        beforeIntegrationRaw = await this.fetchRawStoreIntegrationDetails(accessToken, storeId);
        this.printIntegrationSnapshot(
          "ESTADO DE INTEGRACIÓN ANTES DE ACTIVATE",
          storeId,
          beforeIntegrationRaw
        );
      } catch (beforeError: unknown) {
        console.log(
          chalk.yellow(
            `⚠ No se pudo consultar el estado previo de integración para la store ${storeId}`
          )
        );

        if (axios.isAxiosError(beforeError)) {
          console.log(
            chalk.yellow(
              `Status previo: ${beforeError.response?.status ?? "N/A"} | ${JSON.stringify(
                beforeError.response?.data ?? {},
                null,
                2
              )}`
            )
          );
        }
      }

      const response = await this.http.post(
        requestUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Store ${storeId} activada correctamente`));
      console.log(
        chalk.green(`Respuesta cruda de activate: ${JSON.stringify(response.data ?? {}, null, 2)}`)
      );

      try {
        const afterIntegrationRaw = await this.fetchRawStoreIntegrationDetails(accessToken, storeId);

        this.printIntegrationSnapshot(
          "ESTADO DE INTEGRACIÓN DESPUÉS DE ACTIVATE",
          storeId,
          afterIntegrationRaw
        );

        this.printActivationWarnings(storeId, afterIntegrationRaw);

        return {
          activation_response: response.data ?? {},
          verification: this.mapIntegrationDetails(storeId, afterIntegrationRaw)
        };
      } catch (afterError: unknown) {
        console.log(
          chalk.yellow(
            `⚠ La activación respondió correctamente, pero no se pudo consultar la verificación posterior de la store ${storeId}`
          )
        );

        if (axios.isAxiosError(afterError)) {
          console.log(
            chalk.yellow(
              `Status posterior: ${afterError.response?.status ?? "N/A"} | ${JSON.stringify(
                afterError.response?.data ?? {},
                null,
                2
              )}`
            )
          );
        }

        return {
          activation_response: response.data ?? {},
          verification: null
        };
      }
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
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
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
    accessToken: string,
    storeId: string,
    payload: UberUpdateStoreIntegrationRequest
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId, payload);

    try {
      console.log(chalk.blue("========================================================"));
      console.log(chalk.blue("UPDATE STORE INTEGRATION - REQUEST"));
      console.log(chalk.blue(`Store ID: ${storeId}`));
      console.log(chalk.blue(`Update URL final: ${requestUrl}`));
      console.log(chalk.blue(`Payload recibido: ${JSON.stringify(payload, null, 2)}`));
      console.log(chalk.blue("========================================================"));

      const response = await this.http.put(
        requestUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log(chalk.green(`✓ Integración de la store ${storeId} actualizada correctamente`));
      console.log(
        chalk.green(`Respuesta cruda de update: ${JSON.stringify(response.data ?? {}, null, 2)}`)
      );

      try {
        const verificationRaw = await this.fetchRawStoreIntegrationDetails(accessToken, storeId);

        this.printIntegrationSnapshot(
          "ESTADO DE INTEGRACIÓN DESPUÉS DE UPDATE",
          storeId,
          verificationRaw
        );

        return {
          update_response: response.data ?? {},
          verification: this.mapIntegrationDetails(storeId, verificationRaw)
        };
      } catch (verificationError: unknown) {
        console.log(
          chalk.yellow(
            `⚠ El update respondió correctamente, pero no se pudo verificar el estado final de la store ${storeId}`
          )
        );

        if (axios.isAxiosError(verificationError)) {
          console.log(
            chalk.yellow(
              `Status verificación: ${verificationError.response?.status ?? "N/A"} | ${JSON.stringify(
                verificationError.response?.data ?? {},
                null,
                2
              )}`
            )
          );
        }

        return {
          update_response: response.data ?? {},
          verification: null
        };
      }
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

  public async removeStoreIntegration(
    accessToken: string,
    storeId: string
  ): Promise<unknown> {
    const requestUrl = this.buildStorePosDataUrl(storeId);

    try {
      console.log(chalk.blue("========================================================"));
      console.log(chalk.blue("REMOVE STORE INTEGRATION - REQUEST"));
      console.log(chalk.blue(`Store ID: ${storeId}`));
      console.log(chalk.blue(`Remove URL final: ${requestUrl}`));
      console.log(chalk.blue("========================================================"));

      const response = await this.http.delete(requestUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      console.log(chalk.green(`✓ Integración removida correctamente para store ${storeId}`));
      console.log(
        chalk.green(`Respuesta cruda de remove: ${JSON.stringify(response.data ?? {}, null, 2)}`)
      );

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

let uberActivationServiceInstance: UberActivationService | null = null;

export function getUberActivationService(): UberActivationService {
  if (!uberActivationServiceInstance) {
    uberActivationServiceInstance = new UberActivationService();
  }

  return uberActivationServiceInstance;
}