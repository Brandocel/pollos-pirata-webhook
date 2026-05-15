import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import {
  getUberReportsService,
  UberReportFileRequest,
  UberReportType
} from "../services/uberReports.service";

function sendDetailedError(
  res: Response,
  defaultMessage: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error(chalk.red(defaultMessage));

  if (error instanceof UberApiRequestError) {
    console.error(chalk.red(error.message));

    res.status(error.statusCode).json({
      ok: false,
      message: defaultMessage,
      error: {
        source: error.source,
        statusCode: error.statusCode,
        detail: error.message,
        requestUrl: error.requestUrl ?? null,
        response: error.details ?? null,
        context: context ?? null
      }
    });
    return;
  }

  if (error instanceof Error) {
    console.error(chalk.red(error.message));

    res.status(500).json({
      ok: false,
      message: defaultMessage,
      error: {
        source: "server",
        statusCode: 500,
        detail: error.message,
        requestUrl: null,
        response: null,
        context: context ?? null
      }
    });
    return;
  }

  res.status(500).json({
    ok: false,
    message: defaultMessage,
    error: {
      source: "server",
      statusCode: 500,
      detail: "Error desconocido",
      requestUrl: null,
      response: null,
      context: context ?? null
    }
  });
}

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeReportPayload(body: unknown): UberReportFileRequest | null {
  if (!isNonArrayObject(body)) {
    return null;
  }

  const reportType = body.report_type;
  const storeUuids = body.store_uuids;
  const startDate = body.start_date;
  const endDate = body.end_date;

  if (typeof reportType !== "string" || reportType.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(storeUuids)) {
    return null;
  }

  const cleanStoreUuids = storeUuids
    .filter((storeUuid): storeUuid is string => typeof storeUuid === "string")
    .map((storeUuid) => storeUuid.trim())
    .filter((storeUuid) => storeUuid.length > 0);

  if (cleanStoreUuids.length === 0) {
    return null;
  }

  if (cleanStoreUuids.length > 50) {
    return null;
  }

  if (typeof startDate !== "string" || startDate.trim().length === 0) {
    return null;
  }

  if (typeof endDate !== "string" || endDate.trim().length === 0) {
    return null;
  }

  return {
    report_type: reportType as UberReportType,
    store_uuids: cleanStoreUuids,
    start_date: startDate,
    end_date: endDate
  };
}

export async function testReportScope(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await getUberReportsService().testReportScope();

    return void res.status(200).json({
      ok: true,
      message: "Scope de reports autorizado correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener token con scope eats.report",
      error,
      {
        scope: "eats.report"
      }
    );
  }
}

export async function getReportFile(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const payload = normalizeReportPayload(req.body);

    if (!payload) {
      return void res.status(400).json({
        ok: false,
        message:
          "El body del reporte es inválido. Debe incluir report_type, store_uuids como arreglo, start_date y end_date. Máximo 50 stores por request."
      });
    }

    const result = await getUberReportsService().getReportFile(payload);

    return void res.status(200).json({
      ok: true,
      message: "Report file obtenido correctamente",
      data: {
        submitted_payload: payload,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener el report file",
      error,
      {
        requestBody: req.body ?? null
      }
    );
  }
}