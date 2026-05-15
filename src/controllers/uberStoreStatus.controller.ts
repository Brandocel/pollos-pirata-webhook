import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import {
  getUberStoreStatusService,
  UberStoreStatusPayload
} from "../services/uberStoreStatus.service";

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

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeUpdateStatusPayload(body: unknown): UberStoreStatusPayload | null {
  if (!isNonArrayObject(body)) {
    return null;
  }

  return body as UberStoreStatusPayload;
}

export async function testStoreStatusWriteScope(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await getUberStoreStatusService().testStoreStatusWriteScope();

    return void res.status(200).json({
      ok: true,
      message: "Scope de store status write autorizado correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener token con scope eats.store.status.write",
      error,
      {
        scope: "eats.store.status.write"
      }
    );
  }
}

export async function testStoreStatusReadScope(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await getUberStoreStatusService().testStoreStatusReadScope();

    return void res.status(200).json({
      ok: true,
      message: "Scope de store status read autorizado correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener token con scope eats.store.status.read",
      error,
      {
        scope: "eats.store.status.read"
      }
    );
  }
}

export async function testRestaurantDeliveryStatusScope(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result =
      await getUberStoreStatusService().testRestaurantDeliveryStatusScope();

    return void res.status(200).json({
      ok: true,
      message:
        "Scope de restaurant delivery status autorizado correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener token con scope eats.store.orders.restaurantdelivery.status",
      error,
      {
        scope: "eats.store.orders.restaurantdelivery.status"
      }
    );
  }
}

export async function getStoreStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const result = await getUberStoreStatusService().getStoreStatus(storeId);

    return void res.status(200).json({
      ok: true,
      message: "Status de store obtenido correctamente",
      data: {
        store_id: storeId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener el status de la store",
      error,
      {
        storeId: req.params.storeId ?? null
      }
    );
  }
}

export async function updateStoreStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const payload = normalizeUpdateStatusPayload(req.body);

    if (!payload) {
      return void res.status(400).json({
        ok: false,
        message: "El body de actualización de status debe ser un objeto JSON válido"
      });
    }

    const result = await getUberStoreStatusService().updateStoreStatus(
      storeId,
      payload
    );

    return void res.status(200).json({
      ok: true,
      message: "Status de store actualizado correctamente",
      data: {
        store_id: storeId,
        submitted_payload: payload,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible actualizar el status de la store",
      error,
      {
        storeId: req.params.storeId ?? null,
        requestBody: req.body ?? null
      }
    );
  }
}