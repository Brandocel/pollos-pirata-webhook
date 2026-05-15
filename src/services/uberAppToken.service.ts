import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { UberApiRequestError } from "./uberActivation.service";

interface UberClientCredentialsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export class UberAppTokenService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly authBaseUrl: string;
  private readonly http: AxiosInstance;

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private currentScopeCacheKey: string | null = null;

  constructor() {
    const clientId = process.env.UBER_CLIENT_ID;
    const clientSecret = process.env.UBER_CLIENT_SECRET;
    const authBaseUrl =
      process.env.UBER_AUTH_BASE_URL || "https://sandbox-login.uber.com";

    if (!clientId) throw new Error("Falta UBER_CLIENT_ID");
    if (!clientSecret) throw new Error("Falta UBER_CLIENT_SECRET");

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.authBaseUrl = authBaseUrl.replace(/\/+$/, "");

    this.http = axios.create({
      timeout: 20000,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip"
      }
    });
  }

  private buildAxiosTokenError(
    error: AxiosError,
    scopes: string[],
    requestUrl: string
  ): UberApiRequestError {
    const normalizedScopes = [...new Set(scopes)].sort().join(" ");
    const statusCode = error.response?.status ?? 500;
    const responseData = error.response?.data ?? null;

    console.error(chalk.red("=============================================="));
    console.error(chalk.red("ERROR OBTENIENDO TOKEN APP-LEVEL UBER"));
    console.error(chalk.red("=============================================="));
    console.error(chalk.red(`requestUrl: ${requestUrl}`));
    console.error(chalk.red(`scopes: ${normalizedScopes}`));
    console.error(chalk.red(`status: ${statusCode}`));
    console.error(chalk.red(`response: ${JSON.stringify(responseData, null, 2)}`));

    let detail = `No se pudo obtener token app-level con scopes: ${normalizedScopes}`;

    if (
      responseData &&
      typeof responseData === "object" &&
      "error_description" in responseData &&
      typeof (responseData as { error_description?: unknown }).error_description === "string"
    ) {
      detail = (responseData as { error_description: string }).error_description;
    } else if (
      responseData &&
      typeof responseData === "object" &&
      "message" in responseData &&
      typeof (responseData as { message?: unknown }).message === "string"
    ) {
      detail = (responseData as { message: string }).message;
    } else if (
      responseData &&
      typeof responseData === "object" &&
      "error" in responseData &&
      typeof (responseData as { error?: unknown }).error === "string"
    ) {
      detail = (responseData as { error: string }).error;
    } else if (error.message) {
      detail = error.message;
    }

    return new UberApiRequestError(
      detail,
      statusCode,
      {
        scopes: normalizedScopes,
        uber_oauth_response: responseData
      },
      "uber",
      requestUrl
    );
  }

  public async getAccessToken(scopes: string[]): Promise<string> {
    const normalizedScopes = [...new Set(scopes)].sort().join(" ");
    const now = Date.now();

    if (
      this.accessToken &&
      this.currentScopeCacheKey === normalizedScopes &&
      now < this.accessTokenExpiresAt
    ) {
      return this.accessToken;
    }

    const form = new URLSearchParams();
    form.append("client_id", this.clientId);
    form.append("client_secret", this.clientSecret);
    form.append("grant_type", "client_credentials");
    form.append("scope", normalizedScopes);

    const requestUrl = `${this.authBaseUrl}/oauth/v2/token`;

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE GET UBER APP TOKEN"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan(`scopes: ${normalizedScopes}`));

      const response = await this.http.post<UberClientCredentialsTokenResponse>(
        requestUrl,
        form,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          validateStatus: (status) => status >= 200 && status < 300
        }
      );

      const tokenData = response.data;

      this.accessToken = tokenData.access_token;
      this.accessTokenExpiresAt =
        Date.now() + Math.max(tokenData.expires_in - 60, 60) * 1000;
      this.currentScopeCacheKey = normalizedScopes;

      console.log(chalk.green(`✓ Token app-level obtenido [scopes: ${normalizedScopes}]`));

      return this.accessToken;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosTokenError(error, scopes, requestUrl);
      }

      console.error(chalk.red("Error desconocido obteniendo token app-level"));

      throw new UberApiRequestError(
        `No se pudo obtener token app-level con scopes: ${normalizedScopes}`,
        500,
        {
          scopes: normalizedScopes,
          original_error: error instanceof Error ? error.message : error
        },
        "server",
        requestUrl
      );
    }
  }
}

let uberAppTokenServiceInstance: UberAppTokenService | null = null;

export function getUberAppTokenService(): UberAppTokenService {
  if (!uberAppTokenServiceInstance) {
    uberAppTokenServiceInstance = new UberAppTokenService();
  }

  return uberAppTokenServiceInstance;
}