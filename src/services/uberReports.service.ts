import axios, { AxiosError, AxiosInstance } from "axios";
import chalk from "chalk";
import { getUberAppTokenService } from "./uberAppToken.service";
import { UberApiRequestError } from "./uberActivation.service";

export type UberReportType =
  | "PAYMENT_DETAILS_REPORT"
  | "FINANCE_SUMMARY_REPORT"
  | "ORDERS_AND_ITEMS_REPORT"
  | "MENU_ITEMS_REPORT"
  | string;

export interface UberReportFileRequest {
  report_type: UberReportType;
  store_uuids: string[];
  start_date: string;
  end_date: string;
}

export interface UberReportFileResponse extends Record<string, unknown> {
  report_url?: string;
  report_file_url?: string;
  url?: string;
  download_url?: string;
  file_url?: string;
  status?: string;
  message?: string;
}

export class UberReportsService {
  private readonly apiBaseUrl: string;
  private readonly http: AxiosInstance;

  constructor() {
    const apiBaseUrl = process.env.UBER_API_BASE_URL || "https://test-api.uber.com";

    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");

    this.http = axios.create({
      timeout: 60000,
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
      "code" in responseData &&
      typeof (responseData as { code?: unknown }).code === "string"
    ) {
      message = (responseData as { code: string }).code;
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

  private async getReportScopedToken(): Promise<string> {
    return getUberAppTokenService().getAccessToken(["eats.report"]);
  }

  private getAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`
    };
  }

  private buildReportFileUrl(): string {
    const customPath = process.env.UBER_REPORTS_PATH;

    if (customPath && customPath.trim().length > 0) {
      const normalizedPath = customPath.startsWith("/")
        ? customPath
        : `/${customPath}`;

      return `${this.apiBaseUrl}${normalizedPath}`;
    }

    return `${this.apiBaseUrl}/v1/eats/report`;
  }

  public async testReportScope(): Promise<{
    scope: string;
    token_obtained: boolean;
  }> {
    await this.getReportScopedToken();

    return {
      scope: "eats.report",
      token_obtained: true
    };
  }

  public async getReportFile(
    payload: UberReportFileRequest
  ): Promise<unknown> {
    const token = await this.getReportScopedToken();
    const requestUrl = this.buildReportFileUrl();

    try {
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan("DEBUG SERVICE GET REPORT FILE"));
      console.log(chalk.cyan("=============================================="));
      console.log(chalk.cyan(`requestUrl: ${requestUrl}`));
      console.log(chalk.cyan("scope: eats.report"));
      console.log(chalk.cyan("payload report hacia Uber:"));
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.http.post<UberReportFileResponse>(
        requestUrl,
        payload,
        {
          headers: {
            ...this.getAuthHeaders(token),
            "Content-Type": "application/json"
          },
          validateStatus: (status) => status >= 200 && status < 300
        }
      );

      console.log(chalk.green("✓ Report file solicitado correctamente"));

      return this.normalizeUberResponse(response.status, response.data);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw this.buildAxiosError(
          error,
          "No fue posible obtener el report file",
          requestUrl
        );
      }

      throw new UberApiRequestError(
        "No fue posible obtener el report file",
        500,
        null,
        "server",
        requestUrl
      );
    }
  }
}

let uberReportsServiceInstance: UberReportsService | null = null;

export function getUberReportsService(): UberReportsService {
  if (!uberReportsServiceInstance) {
    uberReportsServiceInstance = new UberReportsService();
  }

  return uberReportsServiceInstance;
}