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
    const first = value.find(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    return typeof first === "string" ? first.trim() : null;
  }

  return null;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

function normalizeActions(
  value: unknown
): Array<"get" | "accept" | "deny" | "cancel" | "update"> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item) =>
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

function normalizeRequestBody(value: unknown): Record<string, unknown> | null {
  const parsedFromString = safeParseJsonObject(value);

  if (parsedFromString) {
    return parsedFromString;
  }

  if (isPlainObject(value)) {
    return value;
  }

  return null;
}

function getStringField(
  source: Record<string, unknown> | null | undefined,
  field: string
): string | null {
  if (!source) return null;

  const value = source[field];

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCancelPayload(
  rawPayload: Record<string, unknown>
): {
  payload: UberCancelOrderPayload | null;
  error?: {
    message: string;
    allowed_reasons?: string[];
    examples?: Record<string, unknown>;
  };
} {
  const allowedReasons = [
    "OUT_OF_ITEMS",
    "KITCHEN_CLOSED",
    "CUSTOMER_CALLED_TO_CANCEL",
    "RESTAURANT_TOO_BUSY",
    "CANNOT_COMPLETE_CUSTOMER_NOTE",
    "OTHER"
  ];

  /**
   * Formato oficial Uber:
   * {
   *   "reason": "CUSTOMER_CALLED_TO_CANCEL",
   *   "details": "..."
   * }
   */
  const officialReason = getStringField(rawPayload, "reason");
  const officialDetails = getStringField(rawPayload, "details");

  /**
   * Formato legacy que ya venías usando:
   * {
   *   "cancellation_reason": {
   *     "code": "CUSTOMER_CALLED_TO_CANCEL",
   *     "description": "..."
   *   }
   * }
   */
  const cancellationReason = isPlainObject(rawPayload.cancellation_reason)
    ? rawPayload.cancellation_reason
    : null;

  const legacyReason = getStringField(cancellationReason, "code");
  const legacyDetails = getStringField(cancellationReason, "description");

  const reason = officialReason || legacyReason;
  const details = officialDetails || legacyDetails;

  if (!reason) {
    return {
      payload: null,
      error: {
        message: "El body es inválido. Debe incluir reason o cancellation_reason.code",
        examples: {
          official: {
            reason: "CUSTOMER_CALLED_TO_CANCEL",
            details: "Cancel order uAPI validation test from POS integration"
          },
          legacy: {
            cancellation_reason: {
              code: "CUSTOMER_CALLED_TO_CANCEL",
              description: "Cancel order uAPI validation test from POS integration"
            }
          }
        }
      }
    };
  }

  if (!allowedReasons.includes(reason)) {
    return {
      payload: null,
      error: {
        message: "El reason enviado no es válido para Cancel Order",
        allowed_reasons: allowedReasons
      }
    };
  }

  return {
    payload: {
      reason,
      ...(details ? { details } : {})
    }
  };
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

  const orderResponse = await uberApiService.getOrderDetails(orderId);

  console.log(chalk.magenta("=============================================="));
  console.log(chalk.magenta("DEBUG ORDER DETAILS FOR ACCESS VALIDATION"));
  console.log(chalk.magenta("=============================================="));
  console.log(chalk.magenta(JSON.stringify(orderResponse, null, 2)));

  const root =
    orderResponse && typeof orderResponse === "object" && !Array.isArray(orderResponse)
      ? (orderResponse as unknown as Record<string, unknown>)
      : {};

  const embeddedOrder =
    root["order"] && typeof root["order"] === "object" && !Array.isArray(root["order"])
      ? (root["order"] as Record<string, unknown>)
      : null;

  const normalizedOrder =
    embeddedOrder ??
    (orderResponse && typeof orderResponse === "object" && !Array.isArray(orderResponse)
      ? (orderResponse as unknown as Record<string, unknown>)
      : null);

  if (!normalizedOrder) {
    throw new Error("La respuesta de detalle de orden no tiene un formato válido.");
  }

  const storeObject =
    normalizedOrder["store"] &&
    typeof normalizedOrder["store"] === "object" &&
    !Array.isArray(normalizedOrder["store"])
      ? (normalizedOrder["store"] as Record<string, unknown>)
      : null;

  const rawOrder =
    normalizedOrder["raw"] &&
    typeof normalizedOrder["raw"] === "object" &&
    !Array.isArray(normalizedOrder["raw"])
      ? (normalizedOrder["raw"] as Record<string, unknown>)
      : null;

  const rawStore =
    rawOrder?.["store"] &&
    typeof rawOrder["store"] === "object" &&
    !Array.isArray(rawOrder["store"])
      ? (rawOrder["store"] as Record<string, unknown>)
      : null;

  const possibleStoreId =
    (storeObject && typeof storeObject["id"] === "string" && String(storeObject["id"]).trim()) ||
    (storeObject &&
      typeof storeObject["store_id"] === "string" &&
      String(storeObject["store_id"]).trim()) ||
    (storeObject &&
      typeof storeObject["merchant_store_id"] === "string" &&
      String(storeObject["merchant_store_id"]).trim()) ||
    (storeObject &&
      typeof storeObject["integrator_store_id"] === "string" &&
      String(storeObject["integrator_store_id"]).trim()) ||
    (rawStore && typeof rawStore["id"] === "string" && String(rawStore["id"]).trim()) ||
    (rawStore &&
      typeof rawStore["store_id"] === "string" &&
      String(rawStore["store_id"]).trim()) ||
    (rawStore &&
      typeof rawStore["merchant_store_id"] === "string" &&
      String(rawStore["merchant_store_id"]).trim()) ||
    (rawStore &&
      typeof rawStore["integrator_store_id"] === "string" &&
      String(rawStore["integrator_store_id"]).trim()) ||
    null;

  if (!possibleStoreId) {
    throw new Error(
      "No fue posible determinar el store.id de la orden. Revisa el log DEBUG ORDER DETAILS FOR ACCESS VALIDATION para ver qué campo regresó Uber."
    );
  }

  const storeId = possibleStoreId;

  const integration = await uberIntegrationService.getStoreIntegrationDetails(storeId);

  const raw =
    integration.raw && typeof integration.raw === "object" && !Array.isArray(integration.raw)
      ? (integration.raw as Record<string, unknown>)
      : {};

  const orderManagerClientId =
    typeof raw["order_manager_client_id"] === "string"
      ? String(raw["order_manager_client_id"]).trim()
      : integration.order_manager_client_id ?? null;

  const appClientId =
    typeof process.env.UBER_CLIENT_ID === "string" &&
    process.env.UBER_CLIENT_ID.trim().length > 0
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

  if (integration.is_order_manager === false) {
    throw new Error(
      `La store ${storeId} tiene is_order_manager=false para esta integración.`
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

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG ACCEPT ORDER"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`orderId: ${orderId}`));
    console.log(chalk.cyan(`typeof req.body: ${typeof req.body}`));
    console.log(chalk.cyan("req.body crudo:"));
    console.log(req.body);

    const normalizedBody =
      normalizeRequestBody(req.body) ?? {};

    console.log(chalk.cyan("normalizedBody accept:"));
    console.log(normalizedBody);

    const rawPayload = normalizedBody;

    const reason =
      typeof rawPayload.reason === "string" && rawPayload.reason.trim().length > 0
        ? rawPayload.reason.trim()
        : undefined;

    const pickupTime =
      typeof rawPayload.pickup_time === "number" && Number.isFinite(rawPayload.pickup_time)
        ? rawPayload.pickup_time
        : typeof rawPayload.pickup_time === "string" && rawPayload.pickup_time.trim() !== ""
          ? Number(rawPayload.pickup_time)
          : undefined;

    const externalReferenceId =
      typeof rawPayload.external_reference_id === "string" &&
      rawPayload.external_reference_id.trim().length > 0
        ? rawPayload.external_reference_id.trim()
        : undefined;

    const fieldsRelayed =
      rawPayload.fields_relayed &&
      typeof rawPayload.fields_relayed === "object" &&
      !Array.isArray(rawPayload.fields_relayed)
        ? (rawPayload.fields_relayed as Record<string, unknown>)
        : undefined;

    const orderPickupInstructions =
      typeof rawPayload.order_pickup_instructions === "string" &&
      rawPayload.order_pickup_instructions.trim().length > 0
        ? rawPayload.order_pickup_instructions.trim()
        : undefined;

    const payload = {
      ...(reason ? { reason } : {}),
      ...(typeof pickupTime === "number" && Number.isFinite(pickupTime)
        ? { pickup_time: pickupTime }
        : {}),
      ...(externalReferenceId ? { external_reference_id: externalReferenceId } : {}),
      ...(fieldsRelayed
        ? {
            fields_relayed: {
              ...(typeof fieldsRelayed.order_special_instructions === "boolean"
                ? { order_special_instructions: fieldsRelayed.order_special_instructions }
                : {}),
              ...(typeof fieldsRelayed.item_special_instructions === "boolean"
                ? { item_special_instructions: fieldsRelayed.item_special_instructions }
                : {}),
              ...(typeof fieldsRelayed.item_special_requests === "boolean"
                ? { item_special_requests: fieldsRelayed.item_special_requests }
                : {}),
              ...(typeof fieldsRelayed.promotions === "boolean"
                ? { promotions: fieldsRelayed.promotions }
                : {})
            }
          }
        : {}),
      ...(orderPickupInstructions
        ? { order_pickup_instructions: orderPickupInstructions }
        : {})
    };

    console.log(chalk.green("payload accept saneado enviado a Uber:"));
    console.log(JSON.stringify(payload, null, 2));

    await validateOrderAccessForWrite(orderId);

    const result = await getUberApiService().acceptOrder(orderId, payload);

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

    const normalizedBody = normalizeRequestBody(req.body);

    console.log(chalk.cyan("normalizedBody deny:"));
    console.log(normalizedBody);

    if (!normalizedBody) {
      res.status(400).json({
        ok: false,
        message: "El body del deny debe ser un objeto JSON válido"
      });
      return;
    }

    const rawPayload = normalizedBody;

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

    const normalizedBody = normalizeRequestBody(req.body);

    console.log(chalk.cyan("normalizedBody cancel:"));
    console.log(normalizedBody);

    if (!normalizedBody) {
      res.status(400).json({
        ok: false,
        message: "El body del cancel debe ser un objeto JSON válido"
      });
      return;
    }

    const normalized = normalizeCancelPayload(normalizedBody);

    if (!normalized.payload) {
      res.status(400).json({
        ok: false,
        message: normalized.error?.message ?? "El body del cancel es inválido",
        ...(normalized.error?.allowed_reasons
          ? { allowed_reasons: normalized.error.allowed_reasons }
          : {}),
        ...(normalized.error?.examples ? { examples: normalized.error.examples } : {})
      });
      return;
    }

    const payload = normalized.payload;

    console.log(chalk.green("payload cancel saneado enviado a Uber:"));
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

    const payload = normalizeRequestBody(req.body);

    if (!payload) {
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

    const body = (normalizeRequestBody(req.body) ?? {}) as Partial<UberOrderValidationFlowPayload>;
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
      accept_payload: body.accept_payload,
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