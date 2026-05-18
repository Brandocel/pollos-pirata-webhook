import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberApiRequestError } from "./uberActivation.service";
import { readMerchantSessionToken } from "../utils/merchantSessionToken";

export interface UberIntegrationActivationPayload {
  is_order_manager?: boolean;
  integrator_store_id?: string;
  integrator_brand_id?: string;
  merchant_store_id?: string;
  require_manual_acceptance?: boolean;
  store_configuration_data?: string;
  allowed_customer_requests?: {
    allow_single_use_items_requests?: boolean;
    allow_special_instruction_requests?: boolean;
  };
  webhooks_config?: {
    schedule_order_webhooks?: {
      is_enabled: boolean;
    };
    order_release_webhooks?: {
      is_enabled: boolean;
    };
    delivery_status_webhooks?: {
      is_enabled: boolean;
    };
    webhooks_version?: string;
  };
}

export class UberIntegrationActivationService {
  private readonly apiBaseUrl: string;
  private readonly http: AxiosInstance;

  constructor() {
    const apiBaseUrl =
      process.env.UBER_API_BASE_URL || "https://test-api.uber.com";

    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");

    this.http = axios.create({
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
      },
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
    console.error(
      chalk.red(`Respuesta: ${JSON.stringify(responseData, null, 2)}`)
    );

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
      "error_description" in responseData &&
      typeof (responseData as { error_description?: unknown })
        .error_description === "string"
    ) {
      message = (responseData as { error_description: string })
        .error_description;
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
        message: "Uber devolvió 204 No Content",
      };
    }

    return data ?? {};
  }

  private getAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private getMerchantSession(merchantSessionToken: string) {
    const session = readMerchantSessionToken(merchantSessionToken);

    if (!session) {
      throw new UberApiRequestError(
        "merchant_session_token inválido o expirado. Vuelve a autenticar el merchant con OAuth Authorization Code.",
        401,
        {
          hint: "Abre nuevamente la URL de autorización de Uber y copia el nuevo session_token.",
        },
        "server",
        undefined
      );
    }

    const scopeText = session.scope ?? "";

    if (!scopeText.includes("eats.pos_provisioning")) {
      throw new UberApiRequestError(
        "El merchant_session_token no contiene el scope eats.pos_provisioning.",
        403,
        {
          current_scope: scopeText,
          required_scope: "eats.pos_provisioning",
        },
        "server",
        undefined
      );
    }

    return session;
  }

  private getMerchantAccessToken(merchantSessionToken: string): string {
    return this.getMerchantSession(merchantSessionToken).accessToken;
  }

  private buildActivateIntegrationUrl(storeId: string): string {
    return `${this.apiBaseUrl}/v1/eats/stores/${encodeURIComponent(
      storeId
    )}/pos_data`;
  }

  private buildDefaultActivationPayload(): UberIntegrationActivationPayload {
    return {
      is_order_manager: true,
      integrator_store_id:
        process.env.UBER_INTEGRATOR_STORE_ID || "pollos-pirata-store-002",
      integrator_brand_id:
        process.env.UBER_INTEGRATOR_BRAND_ID || "pollos-pirata-brand-002",
      merchant_store_id:
        process.env.UBER_MERCHANT_STORE_ID ||
        "pollos-pirata-merchant-store-001",
      require_manual_acceptance: false,
      allowed_customer_requests: {
        allow_single_use_items_requests: false,
        allow_special_instruction_requests: true,
      },
      webhooks_config: {
        schedule_order_webhooks: {
          is_enabled: true,
        },
        order_release_webhooks: {
          is_enabled: false,
        },
        delivery_status_webhooks: {
          is_enabled: false,
        },
        webhooks_version: "1.0.0",
      },
      store_configuration_data: JSON.stringify({
        source: "pollos-pirata-webhook",
        environment: process.env.NODE_ENV || "development",
        integration: "uber-eats-pos",
      }),
    };
  }

  public async testMerchantSessionScopes(
    merchantSessionToken: string
  ): Promise<{
    token_obtained: boolean;
    required_scope: string;
    current_scope: string;
    expires_at: number;
    note: string;
  }> {
    const session = this.getMerchantSession(merchantSessionToken);
    const currentScope = session.scope ?? "";

    return {
      token_obtained: true,
      required_scope: "eats.pos_provisioning",
      current_scope: currentScope,
      expires_at: session.expiresAt,
      note: "Token de merchant válido para Integration Activation",
    };
  }

  public async activateIntegration(
    merchantSessionToken: string,
    storeId: string,
    payload?: UberIntegrationActivationPayload
  ): Promise<unknown> {
    const accessToken = this.getMerchantAccessToken(merchantSessionToken);
    const requestUrl = this.buildActivateIntegrationUrl(storeId);

    const requestBody = {
      ...this.buildDefaultActivationPayload(),
      ...(payload ?? {}),
    };

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE ACTIVATE INTEGRATION"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`method: POST`));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("auth: merchant session token"));
      console.log(chalk.cyan("required scope: eats.pos_provisioning"));
      console.log(chalk.cyan("payload activate integration hacia Uber:"));
      console.log(JSON.stringify(requestBody, null, 2));

      const response = await this.http.post(requestUrl, requestBody, {
        headers: {
          ...this.getAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        validateStatus: (status) => status >= 200 && status < 300,
      });

      console.log(chalk.green("✓ Activate Integration ejecutado correctamente"));

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          "No fue posible ejecutar Activate Integration",
          requestUrl
        );
      }

      throw new UberApiRequestError(
        "No fue posible ejecutar Activate Integration",
        500,
        null,
        "server",
        requestUrl
      );
    }
  }
}

let uberIntegrationActivationServiceInstance: UberIntegrationActivationService | null =
  null;

export function getUberIntegrationActivationService(): UberIntegrationActivationService {
  if (!uberIntegrationActivationServiceInstance) {
    uberIntegrationActivationServiceInstance =
      new UberIntegrationActivationService();
  }

  return uberIntegrationActivationServiceInstance;
}