import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import { getUberStoreService } from "../services/uberStore.service";
import {
  UberHolidayHour,
  UberHolidayHoursMap,
  UberOpenTimePeriod,
  UberUpdateHolidayHoursRequest
} from "../types/uber";

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

function requireValidStoreId(req: Request, res: Response): string | null {
  const { storeId } = req.params;

  if (!storeId || Array.isArray(storeId)) {
    res.status(400).json({
      ok: false,
      message: "Falta el storeId o el formato es inválido"
    });

    return null;
  }

  return storeId;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function normalizeOpenTimePeriods(value: unknown): UberOpenTimePeriod[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized: UberOpenTimePeriod[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }

    const start_time = (item as Record<string, unknown>).start_time;
    const end_time = (item as Record<string, unknown>).end_time;

    if (!isValidTime(start_time) || !isValidTime(end_time)) {
      return null;
    }

    normalized.push({
      start_time,
      end_time
    });
  }

  return normalized;
}

function normalizeHolidayHoursMap(value: unknown): UberHolidayHoursMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const result: UberHolidayHoursMap = {};

  for (const [date, holidayHour] of Object.entries(raw)) {
    if (!isValidDate(date)) {
      return null;
    }

    if (!holidayHour || typeof holidayHour !== "object" || Array.isArray(holidayHour)) {
      return null;
    }

    const open_time_periods = normalizeOpenTimePeriods(
      (holidayHour as Record<string, unknown>).open_time_periods
    );

    if (open_time_periods === null) {
      return null;
    }

    const normalizedHolidayHour: UberHolidayHour = {
      open_time_periods
    };

    result[date] = normalizedHolidayHour;
  }

  return result;
}

export async function getMerchantStoreHolidayHours(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const result = await getUberStoreService().getHolidayHours(storeId);

    return void res.status(200).json({
      ok: true,
      message: "Holiday hours obtenidos correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener los holiday hours de la store",
      error,
      {
        storeId: req.params.storeId ?? null
      }
    );
  }
}

export async function updateMerchantStoreHolidayHours(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const holidayHours = normalizeHolidayHoursMap(req.body?.holiday_hours);

    if (!holidayHours) {
      return void res.status(400).json({
        ok: false,
        message:
          "El body es inválido. Debe incluir holiday_hours con fechas YYYY-MM-DD y open_time_periods con horas HH:mm"
      });
    }

    const payload: UberUpdateHolidayHoursRequest = {
      holiday_hours: holidayHours
    };

    await getUberStoreService().updateHolidayHours(storeId, payload);

    return void res.status(200).json({
      ok: true,
      message: "Holiday hours actualizados correctamente",
      data: {
        store_id: storeId,
        submitted_payload: payload,
        note: "Uber sobrescribe todos los holiday hours existentes en cada POST"
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible actualizar los holiday hours de la store",
      error,
      {
        storeId: req.params.storeId ?? null,
        requestBody: req.body ?? null
      }
    );
  }
}