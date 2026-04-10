import { Request, Response } from "express";
import chalk from "chalk";
import {
  getUberApiService,
  UberCancelOrderPayload,
  UberOrderValidationFlowPayload
} from "../services/uberApi";

function getSingleString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim().length > 0);
    return typeof first === "string" ? first.trim() : null;
  }

  return null;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function resolveOrderId(req: Request, res: Response): string | null {
  const orderId = getSingleString(req.params.orderId);

  if (!orderId) {
    res.status(400).json({
      ok: false,
      message: "orderId es requerido"
    });
    return null;
  }

  if (!looksLikeUuid(orderId)) {
    res.status(400).json({
      ok: false,
      message: "orderId debe tener formato UUID válido"
    });
    return null;
  }

  return orderId;
}

function sendError(res: Response, defaultMessage: string, error: unknown): void {
  console.error(chalk.red(defaultMessage));
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));

  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;

  const details =
    typeof error === "object" &&
    error !== null &&
    "details" in error
      ? (error as { details?: unknown }).details
      : null;

  const requestUrl =
    typeof error === "object" &&
    error !== null &&
    "requestUrl" in error &&
    typeof (error as { requestUrl?: unknown }).requestUrl === "string"
      ? (error as { requestUrl: string }).requestUrl
      : null;

  res.status(statusCode).json({
    ok: false,
    message: defaultMessage,
    error: error instanceof Error ? error.message : "Error desconocido",
    details,
    request_url: requestUrl
  });
}

function normalizeActions(value: unknown): Array<"get" | "accept" | "deny" | "cancel" | "update"> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) =>
    item === "get" ||
    item === "accept" ||
    item === "deny" ||
    item === "cancel" ||
    item === "update"
  ) as Array<"get" | "accept" | "deny" | "cancel" | "update">;
}

function safeParseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getOrderDetails(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    const uberApiService = getUberApiService();
    const order = await uberApiService.getOrderDetails(orderId);

    console.log(chalk.green(`✓ Detalle de orden obtenido correctamente para ${orderId}`));

    res.status(200).json({
      ok: true,
      message: "Detalle de orden obtenido correctamente",
      data: order
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible obtener el detalle de la orden", error);
  }
}

export async function listStoreOrders(req: Request, res: Response): Promise<void> {
  try {
    const storeId = getSingleString(req.params.storeId);

    if (!storeId) {
      res.status(400).json({
        ok: false,
        message: "storeId es requerido"
      });
      return;
    }

    const state = getSingleString(req.query.state);
    const status = getSingleString(req.query.status);
    const start_time = getSingleString(req.query.start_time);
    const end_time = getSingleString(req.query.end_time);
    const expand = getSingleString(req.query.expand);
    const page_size =
      typeof req.query.page_size === "string" && req.query.page_size.trim() !== ""
        ? Number(req.query.page_size)
        : undefined;

    const uberApiService = getUberApiService();
    const result = await uberApiService.listStoreOrders(storeId, {
      state: state ?? undefined,
      status: status ?? undefined,
      start_time: start_time ?? undefined,
      end_time: end_time ?? undefined,
      expand: expand ?? undefined,
      page_size: Number.isFinite(page_size) ? page_size : undefined
    });

    console.log(chalk.green(`✓ Lista de órdenes obtenida correctamente para store ${storeId}`));

    res.status(200).json({
      ok: true,
      message: "Órdenes de la store obtenidas correctamente",
      data: result
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible obtener las órdenes de la store", error);
  }
}

export async function acceptOrderManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    const result = await getUberApiService().acceptOrder(orderId);

    res.status(200).json({
      ok: true,
      message: "Pedido aceptado correctamente",
      data: {
        order_id: orderId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible aceptar el pedido", error);
  }
}

export async function denyOrderManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    const result = await getUberApiService().denyOrder(orderId);

    res.status(200).json({
      ok: true,
      message: "Pedido denegado correctamente",
      data: {
        order_id: orderId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible denegar el pedido", error);
  }
}

export async function cancelOrderManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG CANCEL ORDER"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`orderId: ${orderId}`));
    console.log(chalk.cyan(`typeof req.body: ${typeof req.body}`));
    console.log(chalk.cyan("req.body crudo:"));
    console.log(req.body);

    const parsedFromString = safeParseJsonObject(req.body);

    if (parsedFromString) {
      console.log(chalk.yellow("req.body llegó como string JSON; se parseó correctamente."));
    }

    const normalizedBody =
      parsedFromString ??
      (req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : null);

    console.log(chalk.cyan("normalizedBody:"));
    console.log(normalizedBody);
    console.log(chalk.cyan(`typeof normalizedBody: ${typeof normalizedBody}`));

    if (!normalizedBody) {
      res.status(400).json({
        ok: false,
        message: "El body del cancel debe ser un objeto JSON válido"
      });
      return;
    }

    const payload = normalizedBody as unknown as UberCancelOrderPayload;

    console.log(chalk.cyan("payload final hacia el service:"));
    console.log(JSON.stringify(payload, null, 2));

    const cancellationReason =
      typeof payload.cancellation_reason === "string"
        ? payload.cancellation_reason
        : null;

    console.log(chalk.cyan(`typeof payload.cancellation_reason: ${typeof payload.cancellation_reason}`));
    console.log(chalk.cyan(`payload.cancellation_reason: ${String(payload.cancellation_reason)}`));

    if (!cancellationReason) {
      res.status(400).json({
        ok: false,
        message: "El body es inválido. Debe incluir cancellation_reason como string"
      });
      return;
    }

    const sanitizedPayload: UberCancelOrderPayload = {
      cancellation_reason: cancellationReason
    };

    console.log(chalk.green("payload saneado enviado a Uber:"));
    console.log(JSON.stringify(sanitizedPayload, null, 2));

    const result = await getUberApiService().cancelOrder(orderId, sanitizedPayload);

    res.status(200).json({
      ok: true,
      message: "Pedido cancelado correctamente",
      data: {
        order_id: orderId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible cancelar el pedido", error);
  }
}

export async function updateOrderManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    const payload = req.body as Record<string, unknown> | undefined;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      res.status(400).json({
        ok: false,
        message: "El body del update debe ser un objeto JSON válido"
      });
      return;
    }

    const result = await getUberApiService().updateOrderCart(orderId, payload);

    res.status(200).json({
      ok: true,
      message: "Pedido actualizado correctamente",
      data: {
        order_id: orderId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible actualizar el pedido", error);
  }
}

export async function runOrderValidationFlow(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    const body = (req.body ?? {}) as Partial<UberOrderValidationFlowPayload>;
    const actions = normalizeActions(body.actions);

    if (actions.length === 0) {
      res.status(400).json({
        ok: false,
        message:
          "Debes enviar actions con al menos una acción válida: get, accept, deny, cancel, update"
      });
      return;
    }

    const result = await getUberApiService().runValidationFlow(orderId, {
      actions,
      cancel_payload: body.cancel_payload,
      update_payload: body.update_payload
    });

    res.status(200).json({
      ok: true,
      message: "Flujo de validación ejecutado",
      data: result
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible ejecutar el flujo de validación", error);
  }
}