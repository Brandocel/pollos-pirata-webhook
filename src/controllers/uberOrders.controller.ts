import { Request, Response } from "express";
import chalk from "chalk";
import {
  getUberApiService,
  UberCancelOrderPayload,
  UberDenyOrderPayload,
  UberOrderValidationFlowPayload
} from "../services/uberApi";
import { getUberIntegrationService } from "../services/uberIntegration.service";

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

async function validateOrderAccessForWrite(orderId: string): Promise<{
  orderId: string;
  storeId: string;
  integrationEnabled?: boolean;
  isOrderManager?: boolean;
  orderManagerClientId?: string | null;
  appClientId?: string | null;
}> {
  const uberApiService = getUberApiService();
  const uberIntegrationService = getUberIntegrationService();

  const order = await uberApiService.getOrderDetails(orderId);

  const storeId =
    order?.store?.id && typeof order.store.id === "string"
      ? order.store.id.trim()
      : null;

  if (!storeId) {
    throw new Error(
      "No fue posible determinar el store.id de la orden. No se puede validar acceso."
    );
  }

  const integration = await uberIntegrationService.getStoreIntegrationDetails(storeId);

  const raw =
    integration.raw && typeof integration.raw === "object" && !Array.isArray(integration.raw)
      ? (integration.raw as Record<string, unknown>)
      : {};

  const orderManagerClientId =
    typeof raw.order_manager_client_id === "string"
      ? raw.order_manager_client_id
      : integration.order_manager_client_id ?? null;

  const appClientId =
    typeof process.env.UBER_CLIENT_ID === "string" && process.env.UBER_CLIENT_ID.trim().length > 0
      ? process.env.UBER_CLIENT_ID.trim()
      : null;

  console.log(chalk.magenta("=============================================="));
  console.log(chalk.magenta("DEBUG VALIDATE ORDER ACCESS"));
  console.log(chalk.magenta("=============================================="));
  console.log(chalk.magenta(`orderId: ${orderId}`));
  console.log(chalk.magenta(`storeId: ${storeId}`));
  console.log(chalk.magenta(`integrationEnabled: ${String(integration.integration_enabled)}`));
  console.log(chalk.magenta(`isOrderManager: ${String(integration.is_order_manager)}`));
  console.log(chalk.magenta(`orderManagerClientId: ${orderManagerClientId ?? "null"}`));
  console.log(chalk.magenta(`appClientId: ${appClientId ?? "null"}`));

  if (integration.integration_enabled === false) {
    throw new Error(
      `La store ${storeId} tiene integration_enabled=false. La integración no está activa para operaciones de escritura.`
    );
  }

  if (integration.is_order_manager !== true) {
    throw new Error(
      `La store ${storeId} no tiene is_order_manager=true para esta integración.`
    );
  }

  if (appClientId && orderManagerClientId && appClientId !== orderManagerClientId) {
    throw new Error(
      `La app actual no es la order manager de la store ${storeId}. order_manager_client_id=${orderManagerClientId}, app_client_id=${appClientId}.`
    );
  }

  return {
    orderId,
    storeId,
    integrationEnabled: integration.integration_enabled,
    isOrderManager: integration.is_order_manager,
    orderManagerClientId,
    appClientId
  };
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

    await validateOrderAccessForWrite(orderId);

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

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG DENY ORDER"));
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

    console.log(chalk.cyan("normalizedBody deny:"));
    console.log(normalizedBody);

    if (!normalizedBody) {
      res.status(400).json({
        ok: false,
        message: "El body del deny debe ser un objeto JSON válido"
      });
      return;
    }

    const rawPayload = normalizedBody as Record<string, unknown>;

    const reason =
      rawPayload.reason &&
      typeof rawPayload.reason === "object" &&
      !Array.isArray(rawPayload.reason)
        ? (rawPayload.reason as Record<string, unknown>)
        : null;

    console.log(chalk.cyan("reason:"));
    console.log(reason);

    const explanation =
      reason && typeof reason.explanation === "string"
        ? reason.explanation.trim()
        : null;

    const code =
      reason && typeof reason.code === "string"
        ? reason.code.trim()
        : null;

    const outOfStockItems =
      reason && Array.isArray(reason.out_of_stock_items)
        ? reason.out_of_stock_items.filter((item): item is string => typeof item === "string")
        : undefined;

    const invalidItems =
      reason && Array.isArray(reason.invalid_items)
        ? reason.invalid_items.filter((item): item is string => typeof item === "string")
        : undefined;

    if (!explanation) {
      res.status(400).json({
        ok: false,
        message: "El body es inválido. Debe incluir reason.explanation"
      });
      return;
    }

    if (!code) {
      res.status(400).json({
        ok: false,
        message: "El body es inválido. Debe incluir reason.code"
      });
      return;
    }

    const payload: UberDenyOrderPayload = {
      reason: {
        explanation,
        code,
        ...(outOfStockItems && outOfStockItems.length > 0
          ? { out_of_stock_items: outOfStockItems }
          : {}),
        ...(invalidItems && invalidItems.length > 0
          ? { invalid_items: invalidItems }
          : {})
      }
    };

    console.log(chalk.green("payload deny saneado enviado a Uber:"));
    console.log(JSON.stringify(payload, null, 2));

    const validation = await validateOrderAccessForWrite(orderId);

    console.log(chalk.green("Validación previa de acceso superada:"));
    console.log(
      JSON.stringify(
        {
          order_id: validation.orderId,
          store_id: validation.storeId,
          integration_enabled: validation.integrationEnabled,
          is_order_manager: validation.isOrderManager,
          order_manager_client_id: validation.orderManagerClientId,
          app_client_id: validation.appClientId
        },
        null,
        2
      )
    );

    const result = await getUberApiService().denyOrder(orderId, payload);

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

    console.log(chalk.cyan("normalizedBody cancel:"));
    console.log(normalizedBody);

    if (!normalizedBody) {
      res.status(400).json({
        ok: false,
        message: "El body del cancel debe ser un objeto JSON válido"
      });
      return;
    }

    const rawPayload = normalizedBody as Record<string, unknown>;
    const cancellationReason =
      rawPayload.cancellation_reason &&
      typeof rawPayload.cancellation_reason === "object" &&
      !Array.isArray(rawPayload.cancellation_reason)
        ? (rawPayload.cancellation_reason as Record<string, unknown>)
        : null;

    console.log(chalk.cyan("cancellationReason:"));
    console.log(cancellationReason);

    const code =
      cancellationReason && typeof cancellationReason.code === "string"
        ? cancellationReason.code.trim()
        : null;

    const description =
      cancellationReason && typeof cancellationReason.description === "string"
        ? cancellationReason.description.trim()
        : undefined;

    if (!code) {
      res.status(400).json({
        ok: false,
        message: "El body es inválido. Debe incluir cancellation_reason.code"
      });
      return;
    }

    const payload: UberCancelOrderPayload = {
      cancellation_reason: {
        code,
        ...(description ? { description } : {})
      }
    };

    console.log(chalk.green("payload cancel saneado enviado a Uber:"));
    console.log(JSON.stringify(payload, null, 2));

    await validateOrderAccessForWrite(orderId);

    const result = await getUberApiService().cancelOrder(orderId, payload);

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

    await validateOrderAccessForWrite(orderId);

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
      deny_payload: body.deny_payload,
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