import axios, { AxiosInstance } from "axios";
import chalk from "chalk";

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
    const authBaseUrl = process.env.UBER_AUTH_BASE_URL || "https://sandbox-login.uber.com";

    if (!clientId) {
      throw new Error("Falta la variable de entorno UBER_CLIENT_ID");
    }

    if (!clientSecret) {
      throw new Error("Falta la variable de entorno UBER_CLIENT_SECRET");
    }

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
      const response = await this.http.post<UberClientCredentialsTokenResponse>(
        requestUrl,
        form,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );

      const tokenData = response.data;

      this.accessToken = tokenData.access_token;
      this.accessTokenExpiresAt = Date.now() + Math.max(tokenData.expires_in - 60, 60) * 1000;
      this.currentScopeCacheKey = normalizedScopes;

      console.log(
        chalk.green(`✓ Token app-level obtenido correctamente [scopes: ${normalizedScopes}]`)
      );

      return this.accessToken;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(chalk.red("Error obteniendo token app-level de Uber"));
        console.error(chalk.red(`Status: ${error.response?.status ?? "N/A"}`));
        console.error(
          chalk.red(`Respuesta: ${JSON.stringify(error.response?.data ?? {}, null, 2)}`)
        );
      }

      throw new Error(`No fue posible obtener el token app-level con scopes: ${normalizedScopes}`);
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