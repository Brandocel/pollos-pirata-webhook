import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberApiRequestError } from "./uberActivation.service";
import { readMerchantSessionToken } from "../utils/merchantSessionToken";

export class UberIntegrationActivationService {
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
      "error_description" in responseData &&
      typeof (responseData as { error_description?: unknown }).error_description === "string"
    ) {
      message = (responseData as { error_description: string }).error_description;
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

  private getMerchantAccessToken(merchantSessionToken: string): string {
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

    return session.accessToken;
  }

  private buildActivateIntegrationUrl(): string {
    const customPath = process.env.UBER_ACTIVATE_INTEGRATION_PATH;

    if (customPath && customPath.trim().length > 0) {
      const normalizedPath = customPath.startsWith("/")
        ? customPath
        : `/${customPath}`;

      return `${this.apiBaseUrl}${normalizedPath}`;
    }

    return `${this.apiBaseUrl}/v1/eats/pos_provisioning/activate`;
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
    const session = readMerchantSessionToken(merchantSessionToken);

    if (!session) {
      throw new UberApiRequestError(
        "merchant_session_token inválido o expirado",
        401,
        null,
        "server",
        undefined
      );
    }

    const currentScope = session.scope ?? "";

    if (!currentScope.includes("eats.pos_provisioning")) {
      throw new UberApiRequestError(
        "El merchant_session_token no contiene eats.pos_provisioning",
        403,
        {
          current_scope: currentScope,
          required_scope: "eats.pos_provisioning",
        },
        "server",
        undefined
      );
    }

    return {
      token_obtained: true,
      required_scope: "eats.pos_provisioning",
      current_scope: currentScope,
      expires_at: session.expiresAt,
      note: "Token de merchant válido para Integration Activation",
    };
  }

  public async activateIntegration(
    merchantSessionToken: string
  ): Promise<unknown> {
    const accessToken = this.getMerchantAccessToken(merchantSessionToken);
    const requestUrl = this.buildActivateIntegrationUrl();

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE ACTIVATE INTEGRATION"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("auth: merchant session token"));
      console.log(chalk.cyan("required scope: eats.pos_provisioning"));

      const response = await this.http.get(requestUrl, {
        headers: this.getAuthHeaders(accessToken),
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

let uberIntegrationActivationServiceInstance: UberIntegrationActivationService | null = null;

export function getUberIntegrationActivationService(): UberIntegrationActivationService {
  if (!uberIntegrationActivationServiceInstance) {
    uberIntegrationActivationServiceInstance =
      new UberIntegrationActivationService();
  }

  return uberIntegrationActivationServiceInstance;
}