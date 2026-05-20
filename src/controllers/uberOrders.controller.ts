import { Request, Response } from "express";
import chalk from "chalk";
import {
  getUberApiService,
  UberAcceptOrderPayload,
  UberCancelOrderPayload,
  UberDenyOrderPayload,
  UberOrderValidationAction,
  UberOrderValidationFlowPayload,
  UberResolveFulfillmentIssuePayload
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
    value.trim()
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

function normalizeActions(value: unknown): UberOrderValidationAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item) =>
      item === "get" ||
      item === "accept" ||
      item === "deny" ||
      item === "cancel" ||
      item === "update" ||
      item === "ready" ||
      item === "resolve_fulfillment_issue"
  ) as UberOrderValidationAction[];
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

function getObjectField(
  source: Record<string, unknown> | null | undefined,
  field: string
): Record<string, unknown> | null {
  if (!source) return null;

  const value = source[field];

  if (isPlainObject(value)) {
    return value;
  }

  return null;
}

function normalizeReasonType(value: string | null | undefined): string {
  if (!value) return "ITEM_ISSUE";

  const normalized = value.trim().toUpperCase();

  if (
    normalized.includes("ITEM") ||
    normalized.includes("OUT_OF") ||
    normalized.includes("UNAVAILABLE") ||
    normalized.includes("SOLD")
  ) {
    return "ITEM_ISSUE";
  }

  if (
    normalized.includes("KITCHEN") ||
    normalized.includes("RESTAURANT") ||
    normalized.includes("BUSY")
  ) {
    return "MERCHANT_ISSUE";
  }

  return normalized;
}

function normalizeAcceptPayload(
  rawPayload: Record<string, unknown>
): UberAcceptOrderPayload {
  const readyForPickupTime =
    getStringField(rawPayload, "ready_for_pickup_time") ??
    getStringField(rawPayload, "readyForPickupTime");

  const externalReferenceId =
    getStringField(rawPayload, "external_reference_id") ??
    getStringField(rawPayload, "externalReferenceId");

  const acceptedBy =
    getStringField(rawPayload, "accepted_by") ??
    getStringField(rawPayload, "acceptedBy") ??
    "Pollos Pirata POS";

  const orderPickupInstructions =
    getStringField(rawPayload, "order_pickup_instructions") ??
    getStringField(rawPayload, "orderPickupInstructions");

  return {
    ...(readyForPickupTime ? { ready_for_pickup_time: readyForPickupTime } : {}),
    ...(externalReferenceId ? { external_reference_id: externalReferenceId } : {}),
    ...(acceptedBy ? { accepted_by: acceptedBy } : {}),
    ...(orderPickupInstructions
      ? { order_pickup_instructions: orderPickupInstructions }
      : {})
  };
}

function normalizeDenyPayload(
  rawPayload: Record<string, unknown>
): {
  payload: UberDenyOrderPayload | null;
  error?: {
    message: string;
    examples?: Record<string, unknown>;
  };
} {
  const denyReason = getObjectField(rawPayload, "deny_reason");
  const legacyReason = getObjectField(rawPayload, "reason");

  const info =
    getStringField(denyReason, "info") ??
    getStringField(denyReason, "description") ??
    getStringField(legacyReason, "explanation") ??
    getStringField(legacyReason, "description") ??
    getStringField(rawPayload, "info") ??
    getStringField(rawPayload, "description");

  const rawType =
    getStringField(denyReason, "type") ??
    getStringField(legacyReason, "code") ??
    getStringField(rawPayload, "type") ??
    getStringField(rawPayload, "code");

  const clientErrorCode =
    getStringField(denyReason, "client_error_code") ??
    getStringField(rawPayload, "client_error_code") ??
    "408";

  const itemMetadata =
    getObjectField(denyReason, "item_metadata") ??
    getObjectField(rawPayload, "item_metadata") ??
    undefined;

  if (!info) {
    return {
      payload: null,
      error: {
        message: "El body es inválido. Debe incluir deny_reason.info",
        examples: {
          official: {
            deny_reason: {
              info: "Order denied from POS integration validation",
              type: "ITEM_ISSUE",
              client_error_code: "408",
              item_metadata: {}
            }
          },
          legacy_supported: {
            reason: {
              explanation: "Order denied from POS integration validation",
              code: "ITEM_ISSUE"
            }
          }
        }
      }
    };
  }

  const type = normalizeReasonType(rawType);

  return {
    payload: {
      deny_reason: {
        info,
        type,
        ...(clientErrorCode ? { client_error_code: clientErrorCode } : {}),
        ...(itemMetadata ? { item_metadata: itemMetadata } : {})
      }
    }
  };
}

function normalizeCancelPayload(
  rawPayload: Record<string, unknown>
): {
  payload: UberCancelOrderPayload | null;
  error?: {
    message: string;
    examples?: Record<string, unknown>;
  };
} {
  const cancellationReason = getObjectField(rawPayload, "cancellation_reason");

  const info =
    getStringField(cancellationReason, "info") ??
    getStringField(cancellationReason, "description") ??
    getStringField(rawPayload, "details") ??
    getStringField(rawPayload, "description") ??
    getStringField(rawPayload, "reason");

  const rawType =
    getStringField(cancellationReason, "type") ??
    getStringField(cancellationReason, "code") ??
    getStringField(rawPayload, "type") ??
    getStringField(rawPayload, "reason");

  const clientErrorCode =
    getStringField(cancellationReason, "client_error_code") ??
    getStringField(rawPayload, "client_error_code") ??
    "408";

  const itemMetadata =
    getObjectField(cancellationReason, "item_metadata") ??
    getObjectField(rawPayload, "item_metadata") ??
    undefined;

  if (!info) {
    return {
      payload: null,
      error: {
        message: "El body es inválido. Debe incluir cancellation_reason.info",
        examples: {
          official: {
            cancellation_reason: {
              info: "Order cancelled from POS integration validation",
              type: "ITEM_ISSUE",
              client_error_code: "408",
              item_metadata: {}
            }
          },
          legacy_supported: {
            reason: "CUSTOMER_CALLED_TO_CANCEL",
            details: "Order cancelled from POS integration validation"
          }
        }
      }
    };
  }

  const type = normalizeReasonType(rawType);

  return {
    payload: {
      cancellation_reason: {
        info,
        type,
        ...(clientErrorCode ? { client_error_code: clientErrorCode } : {}),
        ...(itemMetadata ? { item_metadata: itemMetadata } : {})
      }
    }
  };
}

function normalizeFulfillmentIssuePayload(
  rawPayload: Record<string, unknown>
): {
  payload: UberResolveFulfillmentIssuePayload | null;
  error?: {
    message: string;
    examples?: Record<string, unknown>;
    allowed_issue_types?: string[];
    allowed_action_types?: string[];
  };
} {
  const allowedIssueTypes = ["OUT_OF_ITEM", "PARTIAL_AVAILABILITY", "FOUND_ITEM"];
  const allowedActionTypes = ["REMOVE_ITEM", "REPLACE_FOR_ME", "ADJUST_ITEM"];

  if (
    Array.isArray(rawPayload.fulfillment_issues) &&
    rawPayload.fulfillment_issues.length > 0
  ) {
    return {
      payload: {
        fulfillment_issues:
          rawPayload.fulfillment_issues as UberResolveFulfillmentIssuePayload["fulfillment_issues"]
      }
    };
  }

  const fulfillmentIssueType =
    getStringField(rawPayload, "fulfillment_issue_type") ||
    getStringField(rawPayload, "issue_type") ||
    "OUT_OF_ITEM";

  const fulfillmentActionType =
    getStringField(rawPayload, "fulfillment_action_type") ||
    getStringField(rawPayload, "action_type") ||
    "REMOVE_ITEM";

  const rootItemInstanceId =
    getStringField(rawPayload, "root_item_instance_id") ||
    getStringField(rawPayload, "instance_id");

  if (!allowedIssueTypes.includes(fulfillmentIssueType)) {
    return {
      payload: null,
      error: {
        message: "fulfillment_issue_type no es válido",
        allowed_issue_types: allowedIssueTypes,
        examples: {
          remove_item: {
            fulfillment_issue_type: "OUT_OF_ITEM",
            fulfillment_action_type: "REMOVE_ITEM",
            root_item_instance_id: "INSTANCE_ID_REAL_DEL_ITEM"
          }
        }
      }
    };
  }

  if (!rootItemInstanceId) {
    return {
      payload: null,
      error: {
        message:
          "Debes enviar root_item_instance_id o fulfillment_issues[].root_item.instance_id. Este valor sale del detalle real de la orden.",
        examples: {
          simplified: {
            fulfillment_issue_type: "OUT_OF_ITEM",
            fulfillment_action_type: "REMOVE_ITEM",
            root_item_instance_id: "INSTANCE_ID_REAL_DEL_ITEM"
          },
          official: {
            fulfillment_issues: [
              {
                fulfillment_issue_type: "OUT_OF_ITEM",
                fulfillment_action_type: "REMOVE_ITEM",
                root_item: {
                  instance_id: "INSTANCE_ID_REAL_DEL_ITEM"
                }
              }
            ]
          }
        }
      }
    };
  }

  const issue: Record<string, unknown> = {
    fulfillment_issue_type: fulfillmentIssueType,
    root_item: {
      instance_id: rootItemInstanceId
    }
  };

  if (fulfillmentIssueType === "OUT_OF_ITEM") {
    if (!allowedActionTypes.includes(fulfillmentActionType)) {
      return {
        payload: null,
        error: {
          message: "fulfillment_action_type no es válido",
          allowed_action_types: allowedActionTypes
        }
      };
    }

    issue.fulfillment_action_type = fulfillmentActionType;
  }

  if (fulfillmentActionType === "REPLACE_FOR_ME") {
    if (
      !rawPayload.item_substitute ||
      typeof rawPayload.item_substitute !== "object" ||
      Array.isArray(rawPayload.item_substitute)
    ) {
      return {
        payload: null,
        error: {
          message:
            "Para fulfillment_action_type REPLACE_FOR_ME debes enviar item_substitute",
          examples: {
            replace_item: {
              fulfillment_issue_type: "OUT_OF_ITEM",
              fulfillment_action_type: "REPLACE_FOR_ME",
              root_item_instance_id: "INSTANCE_ID_REAL_DEL_ITEM",
              item_substitute: {
                id: "ITEM_ID_REEMPLAZO_DEL_MENU",
                quantity: 1
              }
            }
          }
        }
      };
    }

    issue.item_substitute = rawPayload.item_substitute;
  }

  if (fulfillmentIssueType === "PARTIAL_AVAILABILITY") {
    if (
      rawPayload.item_availability_info &&
      typeof rawPayload.item_availability_info === "object" &&
      !Array.isArray(rawPayload.item_availability_info)
    ) {
      issue.item_availability_info = rawPayload.item_availability_info;
    } else if (
      typeof rawPayload.items_available === "number" &&
      Number.isFinite(rawPayload.items_available)
    ) {
      issue.item_availability_info = {
        items_available: rawPayload.items_available
      };
    } else {
      return {
        payload: null,
        error: {
          message:
            "Para PARTIAL_AVAILABILITY debes enviar item_availability_info o items_available",
          examples: {
            partial_availability: {
              fulfillment_issue_type: "PARTIAL_AVAILABILITY",
              root_item_instance_id: "INSTANCE_ID_REAL_DEL_ITEM",
              items_available: 1
            }
          }
        }
      };
    }
  }

  return {
    payload: {
      fulfillment_issues: [
        issue as UberResolveFulfillmentIssuePayload["fulfillment_issues"][number]
      ]
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
    console.log(chalk.cyan("DEBUG ACCEPT ORDER uAPI"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`orderId: ${orderId}`));
    console.log(chalk.cyan(`typeof req.body: ${typeof req.body}`));
    console.log(chalk.cyan("req.body crudo:"));
    console.log(req.body);

    const normalizedBody = normalizeRequestBody(req.body) ?? {};
    const payload = normalizeAcceptPayload(normalizedBody);

    console.log(chalk.green("payload accept uAPI saneado enviado a Uber:"));
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

    const result = await getUberApiService().acceptOrder(orderId, payload);

    res.status(200).json({
      ok: true,
      message: "Pedido aceptado correctamente usando uAPI",
      data: {
        order_id: orderId,
        uber_endpoint: `/v1/delivery/order/${orderId}/accept`,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible aceptar el pedido usando uAPI", error);
  }
}

export async function denyOrderManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG DENY ORDER uAPI"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`orderId: ${orderId}`));
    console.log(chalk.cyan(`typeof req.body: ${typeof req.body}`));
    console.log(chalk.cyan("req.body crudo:"));
    console.log(req.body);

    const normalizedBody = normalizeRequestBody(req.body);

    if (!normalizedBody) {
      res.status(400).json({
        ok: false,
        message: "El body del deny debe ser un objeto JSON válido"
      });
      return;
    }

    const normalized = normalizeDenyPayload(normalizedBody);

    if (!normalized.payload) {
      res.status(400).json({
        ok: false,
        message: normalized.error?.message ?? "El body del deny es inválido",
        ...(normalized.error?.examples ? { examples: normalized.error.examples } : {})
      });
      return;
    }

    const payload = normalized.payload;

    console.log(chalk.green("payload deny uAPI saneado enviado a Uber:"));
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
      message: "Pedido denegado correctamente usando uAPI",
      data: {
        order_id: orderId,
        uber_endpoint: `/v1/delivery/order/${orderId}/deny`,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible denegar el pedido usando uAPI", error);
  }
}

export async function cancelOrderManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG CANCEL ORDER uAPI"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`orderId: ${orderId}`));
    console.log(chalk.cyan(`typeof req.body: ${typeof req.body}`));
    console.log(chalk.cyan("req.body crudo:"));
    console.log(req.body);

    const normalizedBody = normalizeRequestBody(req.body);

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
        ...(normalized.error?.examples ? { examples: normalized.error.examples } : {})
      });
      return;
    }

    const payload = normalized.payload;

    console.log(chalk.green("payload cancel uAPI saneado enviado a Uber:"));
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
      message: "Pedido cancelado correctamente usando uAPI",
      data: {
        order_id: orderId,
        uber_endpoint: `/v1/delivery/order/${orderId}/cancel`,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible cancelar el pedido usando uAPI", error);
  }
}

export async function markOrderAsReadyManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG MARK ORDER AS READY"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`orderId: ${orderId}`));
    console.log(chalk.cyan(`typeof req.body: ${typeof req.body}`));
    console.log(chalk.cyan("req.body crudo:"));
    console.log(req.body);

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

    const result = await getUberApiService().markOrderReady(orderId);

    res.status(200).json({
      ok: true,
      message: "Pedido marcado como listo correctamente",
      data: {
        order_id: orderId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible marcar el pedido como listo", error);
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

export async function resolveOrderFulfillmentIssueManually(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const orderId = resolveOrderId(req, res);
    if (!orderId) return;

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG RESOLVE ORDER FULFILLMENT ISSUE"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`orderId: ${orderId}`));
    console.log(chalk.cyan(`typeof req.body: ${typeof req.body}`));
    console.log(chalk.cyan("req.body crudo:"));
    console.log(req.body);

    const normalizedBody = normalizeRequestBody(req.body);

    if (!normalizedBody) {
      res.status(400).json({
        ok: false,
        message: "El body debe ser un objeto JSON válido",
        examples: {
          simplified: {
            fulfillment_issue_type: "OUT_OF_ITEM",
            fulfillment_action_type: "REMOVE_ITEM",
            root_item_instance_id: "INSTANCE_ID_REAL_DEL_ITEM"
          },
          official: {
            fulfillment_issues: [
              {
                fulfillment_issue_type: "OUT_OF_ITEM",
                fulfillment_action_type: "REMOVE_ITEM",
                root_item: {
                  instance_id: "INSTANCE_ID_REAL_DEL_ITEM"
                }
              }
            ]
          }
        }
      });
      return;
    }

    const normalized = normalizeFulfillmentIssuePayload(normalizedBody);

    if (!normalized.payload) {
      res.status(400).json({
        ok: false,
        message:
          normalized.error?.message ??
          "El body de fulfillment issues es inválido",
        ...(normalized.error?.allowed_issue_types
          ? { allowed_issue_types: normalized.error.allowed_issue_types }
          : {}),
        ...(normalized.error?.allowed_action_types
          ? { allowed_action_types: normalized.error.allowed_action_types }
          : {}),
        ...(normalized.error?.examples
          ? { examples: normalized.error.examples }
          : {})
      });
      return;
    }

    const payload = normalized.payload;

    console.log(chalk.green("payload fulfillment issue saneado enviado a Uber:"));
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

    const result = await getUberApiService().resolveOrderFulfillmentIssue(
      orderId,
      payload
    );

    res.status(200).json({
      ok: true,
      message: "Fulfillment issue enviado correctamente a Uber",
      data: {
        order_id: orderId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    sendError(res, "No fue posible resolver el fulfillment issue de la orden", error);
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
          "Debes enviar actions con al menos una acción válida: get, accept, deny, cancel, update, ready, resolve_fulfillment_issue"
      });
      return;
    }

    const result = await getUberApiService().runValidationFlow(orderId, {
      actions,
      accept_payload: body.accept_payload,
      deny_payload: body.deny_payload,
      cancel_payload: body.cancel_payload,
      update_payload: body.update_payload,
      resolve_fulfillment_issue_payload: body.resolve_fulfillment_issue_payload
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