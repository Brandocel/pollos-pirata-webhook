import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

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
        message: "Uber devolvió 204 No Content"
      };
    }

    return data ?? {};
  }

  private getAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  private async getActivationScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken([
      "eats.store",
      "eats.pos_provisioning"
    ]);
  }

  private buildActivateIntegrationUrl(): string {
    const customPath = process.env.UBER_ACTIVATE_INTEGRATION_PATH;

    if (customPath && customPath.trim().length > 0) {
      const normalizedPath = customPath.startsWith("/")
        ? customPath
        : `/${customPath}`;

      return `${this.apiBaseUrl}${normalizedPath}`;
    }

    /*
      IMPORTANTE:
      Esta ruta queda configurable porque Uber puede variar el path exacto
      según la documentación de Integration Activation Suite.

      Primero probaremos el scope. Después, si el scope funciona,
      ajustamos UBER_ACTIVATE_INTEGRATION_PATH con el path exacto de Uber.
    */
    return `${this.apiBaseUrl}/v1/eats/pos_provisioning/activate`;
  }

  public async testActivationScopes(): Promise<{
    scopes: string[];
    token_obtained: boolean;
    note: string;
  }> {
    await this.getActivationScopedToken();

    return {
      scopes: ["eats.store", "eats.pos_provisioning"],
      token_obtained: true,
      note: "Token obtenido correctamente para Integration Activation"
    };
  }

  public async activateIntegration(): Promise<unknown> {
    const token = await this.getActivationScopedToken();
    const requestUrl = this.buildActivateIntegrationUrl();

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE ACTIVATE INTEGRATION"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("scopes: eats.store eats.pos_provisioning"));

      const response = await this.http.get(requestUrl, {
        headers: this.getAuthHeaders(token),
        validateStatus: (status) => status >= 200 && status < 300
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
    uberIntegrationActivationServiceInstance = new UberIntegrationActivationService();
  }

  return uberIntegrationActivationServiceInstance;
}