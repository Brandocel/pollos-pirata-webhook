import { Request, Response } from "express";
import chalk from "chalk";
import { getUberApiService } from "../services/uberApi";
import {
  saveWebhookSummary,
  getLastWebhookState,
  getWebhookHistory,
  clearWebhookHistory,
  getWebhookEvidence,
  WebhookDiagnosticSummary,
  WebhookProcessingStatus
} from "../services/uberWebhookState.service";
import {
  UberCartItem,
  UberModifierGroup,
  UberOrderDetails,
  UberWebhookEvent
} from "../types/uber";
import { verifyUberSignature } from "../utils/signature";

type WebhookPayloadRecord = UberWebhookEvent & Record<string, unknown>;

function safeJsonParse<T>(rawBody: Buffer): T {
  return JSON.parse(rawBody.toString("utf8")) as T;
}

function getSingleString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      if (typeof item === "number" || typeof item === "boolean") return true;
      return false;
    });

    if (typeof first === "string") {
      return first.trim();
    }

    if (typeof first === "number" || typeof first === "boolean") {
      return String(first);
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function extractOrderIdFromResourceHref(resourceHref?: string | null): string | null {
  if (!resourceHref || typeof resourceHref !== "string") {
    return null;
  }

  const match =
    resourceHref.match(/\/order\/([^/?#]+)/i) ||
    resourceHref.match(/\/orders\/([^/?#]+)/i);

  if (!match?.[1]) {
    return null;
  }

  return match[1].trim() || null;
}

function formatMoney(formatted?: string, amount?: number, currency?: string): string {
  if (formatted) {
    return formatted;
  }

  if (typeof amount === "number") {
    return `${(amount / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }

  return "No disponible";
}

function getDeliveryAddress(order: UberOrderDetails): string {
  const location = order.eater?.delivery?.location;

  if (!location) {
    return "No disponible / pedido no expone dirección";
  }

  const parts = [
    location.title,
    location.street_address,
    location.unit_number ? `Unidad: ${location.unit_number}` : undefined,
    location.business_name ? `Referencia: ${location.business_name}` : undefined
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "No disponible / pedido no expone dirección";
}

function printDivider(
  title: string,
  color: "blue" | "green" | "yellow" | "red" | "cyan" | "gray" = "blue"
): void {
  const line = "========================================================";
  const printer =
    color === "green"
      ? chalk.green
      : color === "yellow"
        ? chalk.yellow
        : color === "red"
          ? chalk.red
          : color === "cyan"
            ? chalk.cyan
            : color === "gray"
              ? chalk.gray
              : chalk.blue;

  console.log(printer(line));
  console.log(printer(` ${title}`));
  console.log(printer(line));
}

function printKeyValue(
  label: string,
  value: unknown,
  color: "white" | "gray" | "green" | "yellow" | "red" | "cyan" = "white"
): void {
  const printer =
    color === "gray"
      ? chalk.gray
      : color === "green"
        ? chalk.green
        : color === "yellow"
          ? chalk.yellow
          : color === "red"
            ? chalk.red
            : color === "cyan"
              ? chalk.cyan
              : chalk.white;

  console.log(printer(`${label}: ${value ?? "N/A"}`));
}

function printModifierGroups(groups?: UberModifierGroup[] | null, indent = "    "): void {
  if (!groups || groups.length === 0) {
    return;
  }

  for (const group of groups) {
    console.log(chalk.cyan(`${indent}Grupo: ${group.title ?? "Sin título"}`));

    for (const selected of group.selected_items ?? []) {
      const quantity = selected.quantity ?? 0;
      const title = selected.title ?? "Modificador sin nombre";

      console.log(chalk.cyan(`${indent}- ${quantity} x ${title}`));

      if (selected.special_instructions) {
        console.log(chalk.yellow(`${indent}  Nota: ${selected.special_instructions}`));
      }

      if (selected.selected_modifier_groups?.length) {
        printModifierGroups(selected.selected_modifier_groups, `${indent}  `);
      }
    }
  }
}

function printOrderSummary(order: UberOrderDetails): void {
  const total = order.payment?.charges?.total;
  const customerName =
    [order.eater?.first_name, order.eater?.last_name].filter(Boolean).join(" ").trim() ||
    "No disponible";

  const phone = order.eater?.phone || "No disponible";
  const address = getDeliveryAddress(order);
  const orderNumber = order.display_id || order.external_reference_id || order.id;

  console.log(chalk.bgGreen.black("=============================================="));
  console.log(chalk.bgGreen.black("       NUEVO PEDIDO - POLLO PIRATA"));
  console.log(chalk.bgGreen.black("=============================================="));
  console.log(chalk.white(`Orden: ${chalk.bold(orderNumber)}`));
  console.log(chalk.white(`Order ID: ${order.id}`));
  console.log(chalk.white(`Estado: ${order.current_state ?? "Desconocido"}`));
  console.log(chalk.white(`Cliente: ${customerName}`));
  console.log(chalk.white(`Teléfono: ${phone}`));
  console.log(chalk.white(`Dirección: ${address}`));
  console.log(
    chalk.white(
      `Total: ${formatMoney(total?.formatted_amount, total?.amount, total?.currency_code)}`
    )
  );

  const instructions = order.cart?.special_instructions?.trim();
  console.log(chalk.magenta(`Instrucciones: ${instructions || "Ninguna"}`));

  console.log(chalk.blue("\nItems:"));
  const items: UberCartItem[] = order.cart?.items ?? [];

  if (items.length === 0) {
    console.log(chalk.yellow("- No se encontraron items"));
  }

  for (const item of items) {
    const qty = item.quantity ?? 0;
    const title = item.title ?? "Item sin nombre";
    const price = item.price?.total_price;

    console.log(
      chalk.green(
        `- ${qty} x ${title} (${formatMoney(
          price?.formatted_amount,
          price?.amount,
          price?.currency_code
        )})`
      )
    );

    if (item.special_instructions?.trim()) {
      console.log(chalk.yellow(`  Nota: ${item.special_instructions.trim()}`));
    }

    if (item.selected_modifier_groups?.length) {
      printModifierGroups(item.selected_modifier_groups, "  ");
    }
  }

  console.log(chalk.bgGreen.black("==============================================\n"));
}

function getWebhookSigningKeys(): string[] {
  const keys = [
    process.env.UBER_WEBHOOK_SIGNING_KEY,
    process.env.UBER_WEBHOOK_SECONDARY_SIGNING_KEY
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return [...new Set(keys)];
}

function verifyWithAnySigningKey(rawBody: Buffer, signatureHeader: string): boolean {
  const signingKeys = getWebhookSigningKeys();

  if (signingKeys.length === 0) {
    console.error(
      chalk.red("ERROR: Faltan UBER_WEBHOOK_SIGNING_KEY / UBER_WEBHOOK_SECONDARY_SIGNING_KEY")
    );
    return false;
  }

  for (const signingKey of signingKeys) {
    const isValid = verifyUberSignature({
      rawBody,
      clientSecret: signingKey,
      signatureHeader
    });

    if (isValid) {
      return true;
    }
  }

  return false;
}

function getPayloadRecord(payload: UberWebhookEvent): WebhookPayloadRecord {
  return payload as WebhookPayloadRecord;
}

function getPayloadMeta(payload: UberWebhookEvent): Record<string, unknown> {
  return isRecord(payload.meta) ? payload.meta : {};
}

function getEventStoreId(payload: UberWebhookEvent): string | null {
  const record = getPayloadRecord(payload);
  const meta = getPayloadMeta(payload);

  return (
    getSingleString(meta.user_id) ||
    getSingleString(meta.store_id) ||
    getSingleString(record.store_id) ||
    getSingleString(record.storeId) ||
    null
  );
}

function getEventOrderId(payload: UberWebhookEvent): string | null {
  const record = getPayloadRecord(payload);
  const meta = getPayloadMeta(payload);

  const resourceId =
    getSingleString(meta.resource_id) ||
    getSingleString(meta.order_id) ||
    getSingleString(meta.orderId) ||
    getSingleString(record.order_id) ||
    getSingleString(record.orderId);

  if (resourceId) {
    return resourceId;
  }

  return extractOrderIdFromResourceHref(getSingleString(payload.resource_href));
}

function getEventStatus(payload: UberWebhookEvent): string | null {
  const record = getPayloadRecord(payload);
  const meta = getPayloadMeta(payload);

  return (
    getSingleString(meta.status) ||
    getSingleString(meta.order_status) ||
    getSingleString(meta.current_state) ||
    getSingleString(record.status) ||
    getSingleString(record.order_status) ||
    getSingleString(record.current_state) ||
    null
  );
}

function normalizeStatus(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function isCancellationStatus(status: string | null): boolean {
  const normalized = normalizeStatus(status);

  return [
    "cancel",
    "canceled",
    "cancelled",
    "order_canceled",
    "order_cancelled",
    "customer_canceled",
    "customer_cancelled",
    "merchant_canceled",
    "merchant_cancelled",
    "pos_canceled",
    "pos_cancelled"
  ].includes(normalized);
}

function isFailureStatus(status: string | null): boolean {
  const normalized = normalizeStatus(status);

  return [
    "failed",
    "failure",
    "order_failed",
    "order_failure",
    "unfulfilled",
    "rejected",
    "denied"
  ].includes(normalized);
}

function stringifyReason(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (isRecord(value)) {
    const code =
      getSingleString(value.code) ||
      getSingleString(value.reason_code) ||
      getSingleString(value.type);

    const description =
      getSingleString(value.description) ||
      getSingleString(value.explanation) ||
      getSingleString(value.message) ||
      getSingleString(value.reason);

    if (code && description) {
      return `${code}: ${description}`;
    }

    if (code) {
      return code;
    }

    if (description) {
      return description;
    }

    return JSON.stringify(value);
  }

  return null;
}

function getCancellationOrFailureReason(payload: UberWebhookEvent): string | null {
  const record = getPayloadRecord(payload);
  const meta = getPayloadMeta(payload);

  return (
    stringifyReason(meta.cancellation_reason) ||
    stringifyReason(meta.cancel_reason) ||
    stringifyReason(meta.failure_reason) ||
    stringifyReason(meta.reason) ||
    stringifyReason(record.cancellation_reason) ||
    stringifyReason(record.cancel_reason) ||
    stringifyReason(record.failure_reason) ||
    stringifyReason(record.reason) ||
    null
  );
}

function getBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "y", "si", "sí"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function getScheduledPickupTime(payload: UberWebhookEvent): string | null {
  const record = getPayloadRecord(payload);
  const meta = getPayloadMeta(payload);

  return (
    getSingleString(meta.scheduled_pickup_time) ||
    getSingleString(meta.scheduledPickupTime) ||
    getSingleString(meta.pickup_time) ||
    getSingleString(meta.pickupTime) ||
    getSingleString(meta.ready_for_pickup_time) ||
    getSingleString(meta.readyForPickupTime) ||
    getSingleString(record.scheduled_pickup_time) ||
    getSingleString(record.scheduledPickupTime) ||
    getSingleString(record.pickup_time) ||
    getSingleString(record.pickupTime) ||
    getSingleString(record.ready_for_pickup_time) ||
    getSingleString(record.readyForPickupTime) ||
    null
  );
}

function isScheduledOrderPayload(payload: UberWebhookEvent): boolean {
  const record = getPayloadRecord(payload);
  const meta = getPayloadMeta(payload);

  const eventType = (payload.event_type ?? "").trim().toLowerCase();
  const eventStatus = normalizeStatus(getEventStatus(payload));

  const scheduledFromMeta =
    getBooleanValue(meta.scheduled_order) ??
    getBooleanValue(meta.scheduledOrder) ??
    getBooleanValue(meta.is_scheduled_order) ??
    getBooleanValue(meta.isScheduledOrder);

  const scheduledFromRecord =
    getBooleanValue(record.scheduled_order) ??
    getBooleanValue(record.scheduledOrder) ??
    getBooleanValue(record.is_scheduled_order) ??
    getBooleanValue(record.isScheduledOrder);

  return (
    eventType.includes("scheduled") ||
    eventStatus === "scheduled" ||
    scheduledFromMeta === true ||
    scheduledFromRecord === true ||
    Boolean(getScheduledPickupTime(payload))
  );
}

function createCancelFailureNote(params: {
  baseNote: string;
  payload: UberWebhookEvent;
}): string {
  const eventStatus = getEventStatus(params.payload);
  const reason = getCancellationOrFailureReason(params.payload);

  const parts = [params.baseNote];

  if (eventStatus) {
    parts.push(`status=${eventStatus}`);
  }

  if (reason) {
    parts.push(`reason=${reason}`);
  }

  return parts.join(" | ");
}

function createSummary(partial?: Partial<WebhookDiagnosticSummary>): WebhookDiagnosticSummary {
  return {
    status: partial?.status ?? "received",
    eventType: partial?.eventType ?? "N/A",
    eventId: partial?.eventId ?? null,
    eventStatus: partial?.eventStatus ?? null,
    storeId: partial?.storeId ?? null,
    orderId: partial?.orderId ?? null,
    resourceHref: partial?.resourceHref ?? null,
    signaturePresent: partial?.signaturePresent ?? false,
    signatureValid: partial?.signatureValid ?? null,
    responded200: partial?.responded200 ?? false,
    receivedAt: partial?.receivedAt ?? new Date().toISOString(),
    note: partial?.note ?? null,
    environment: partial?.environment ?? null,

    scheduledOrder: partial?.scheduledOrder ?? null,
    scheduledPickupTime: partial?.scheduledPickupTime ?? null,

    cancellationReason: partial?.cancellationReason ?? null,
    failureReason: partial?.failureReason ?? null,
    rawMeta: partial?.rawMeta ?? null
  };
}

function persistAndPrintSummary(summary: WebhookDiagnosticSummary): void {
  saveWebhookSummary(summary);

  printDivider("RESUMEN WEBHOOK", "cyan");
  printKeyValue("status", summary.status, "cyan");
  printKeyValue("eventType", summary.eventType ?? "N/A", "white");
  printKeyValue("eventId", summary.eventId ?? "N/A", "white");
  printKeyValue("eventStatus", summary.eventStatus ?? "N/A", "white");
  printKeyValue("storeId", summary.storeId ?? "N/A", "white");
  printKeyValue("orderId", summary.orderId ?? "N/A", "white");
  printKeyValue("resourceHref", summary.resourceHref ?? "N/A", "white");
  printKeyValue("signaturePresent", summary.signaturePresent ? "Sí" : "No", "white");
  printKeyValue(
    "signatureValid",
    summary.signatureValid === null ? "No evaluada" : summary.signatureValid ? "Sí" : "No",
    summary.signatureValid === false ? "red" : "white"
  );
  printKeyValue(
    "responded200",
    summary.responded200 ? "Sí" : "No",
    summary.responded200 ? "green" : "red"
  );
  printKeyValue("receivedAt", summary.receivedAt, "white");
  printKeyValue("environment", summary.environment ?? "N/A", "white");

  if (summary.scheduledOrder !== null && summary.scheduledOrder !== undefined) {
    printKeyValue("scheduledOrder", summary.scheduledOrder ? "Sí" : "No", "cyan");
  }

  if (summary.scheduledPickupTime) {
    printKeyValue("scheduledPickupTime", summary.scheduledPickupTime, "cyan");
  }

  if (summary.cancellationReason) {
    printKeyValue("cancellationReason", summary.cancellationReason, "red");
  }

  if (summary.failureReason) {
    printKeyValue("failureReason", summary.failureReason, "red");
  }

  if (summary.note) {
    printKeyValue("note", summary.note, "yellow");
  }
}

async function processOrdersNotification(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const orderId = getEventOrderId(payload);
  const storeId = getEventStoreId(payload);
  const eventStatus = getEventStatus(payload);
  const meta = getPayloadMeta(payload);

  printDivider("PROCESANDO orders.notification", "gray");
  printKeyValue("event_id", payload.event_id || "N/A", "gray");
  printKeyValue("event_type", payload.event_type || "N/A", "gray");
  printKeyValue("event_status", eventStatus || "N/A", "gray");
  printKeyValue("store_id(meta.user_id)", storeId || "N/A", "gray");
  printKeyValue("resource_id(meta.resource_id)", payload.meta?.resource_id || "N/A", "gray");
  printKeyValue("resource_href", payload.resource_href || "N/A", "gray");
  printKeyValue("order_id resuelto", orderId || "N/A", "gray");

  /**
   * Protección importante:
   * Si Uber manda una cancelación con event_type=orders.notification
   * y meta.status=canceled/cancelled/failed, NO intentamos consultar detalle
   * ni aceptar. Solo guardamos evidencia y dejamos el ACK 200 ya enviado.
   */
  if (isCancellationStatus(eventStatus)) {
    const status: WebhookProcessingStatus = "order_cancelled_webhook_received";
    const reason = getCancellationOrFailureReason(payload);

    return createSummary({
      status,
      eventType: payload.event_type ?? "N/A",
      eventId: payload.event_id ?? null,
      eventStatus,
      storeId,
      orderId,
      resourceHref: getSingleString(payload.resource_href),
      cancellationReason: reason,
      rawMeta: Object.keys(meta).length > 0 ? meta : null,
      note: createCancelFailureNote({
        baseNote: "Cancel Notification Handling: orders.notification recibido con status de cancelación",
        payload
      })
    });
  }

  if (isFailureStatus(eventStatus)) {
    const status: WebhookProcessingStatus = "order_failure_webhook_received";
    const reason = getCancellationOrFailureReason(payload);

    return createSummary({
      status,
      eventType: payload.event_type ?? "N/A",
      eventId: payload.event_id ?? null,
      eventStatus,
      storeId,
      orderId,
      resourceHref: getSingleString(payload.resource_href),
      failureReason: reason,
      rawMeta: Object.keys(meta).length > 0 ? meta : null,
      note: createCancelFailureNote({
        baseNote: "Cancel Notification Handling: orders.notification recibido con status de falla",
        payload
      })
    });
  }

  /**
   * Si el evento viene como orders.notification, pero trae estado o metadata de scheduled,
   * lo registramos como scheduled y NO lo dejamos como pedido normal.
   */
  if (isScheduledOrderPayload(payload)) {
    return processOrdersScheduledNotification(payload);
  }

  if (!orderId || !looksLikeUuid(orderId)) {
    return createSummary({
      status: "invalid_order_id",
      eventType: payload.event_type ?? "N/A",
      eventId: payload.event_id ?? null,
      eventStatus,
      storeId,
      orderId: orderId ?? null,
      resourceHref: getSingleString(payload.resource_href),
      rawMeta: Object.keys(meta).length > 0 ? meta : null,
      note: "No se pudo resolver un order_id UUID válido desde el payload"
    });
  }

  const uberApiService = getUberApiService();
  const order = await uberApiService.getOrderDetails(orderId);

  printOrderSummary(order);

  const autoAccept = process.env.AUTO_ACCEPT_ORDERS === "true";

  if (autoAccept) {
    console.log(chalk.green("Auto-aceptando pedido..."));
    await uberApiService.acceptOrder(orderId);
    console.log(chalk.green("✅ Pedido aceptado automáticamente"));

    return createSummary({
      status: "auto_accepted",
      eventType: payload.event_type ?? "N/A",
      eventId: payload.event_id ?? null,
      eventStatus,
      storeId,
      orderId,
      resourceHref: getSingleString(payload.resource_href),
      rawMeta: Object.keys(meta).length > 0 ? meta : null,
      note: "Pedido aceptado automáticamente desde webhook"
    });
  }

  console.log(
    chalk.yellow("AUTO_ACCEPT_ORDERS=false → Pedido queda pendiente de aceptación manual")
  );

  return createSummary({
    status: "manual_pending",
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    eventStatus,
    storeId,
    orderId,
    resourceHref: getSingleString(payload.resource_href),
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
    note: "Pedido recibido correctamente; pendiente de aceptación manual"
  });
}

async function processOrdersFailure(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const status: WebhookProcessingStatus = "order_failure_webhook_received";
  const eventStatus = getEventStatus(payload);
  const storeId = getEventStoreId(payload);
  const orderId = getEventOrderId(payload);
  const resourceHref = getSingleString(payload.resource_href);
  const reason = getCancellationOrFailureReason(payload);
  const meta = getPayloadMeta(payload);

  printDivider("EVENTO orders.failure", "red");
  printKeyValue("event_id", payload.event_id || "N/A", "red");
  printKeyValue("event_type", payload.event_type || "N/A", "red");
  printKeyValue("event_status", eventStatus || "N/A", "red");
  printKeyValue("store_id", storeId || "N/A", "red");
  printKeyValue("order_id", orderId || "N/A", "red");
  printKeyValue("resource_href", resourceHref || "N/A", "red");
  printKeyValue("reason", reason || "N/A", "red");

  return createSummary({
    status,
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    eventStatus,
    storeId,
    orderId,
    resourceHref,
    failureReason: reason,
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
    note: createCancelFailureNote({
      baseNote: "Cancel Notification Handling: webhook orders.failure recibido y confirmado con ACK 200",
      payload
    })
  });
}

async function processOrdersCancel(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const status: WebhookProcessingStatus = "order_cancelled_webhook_received";
  const eventStatus = getEventStatus(payload);
  const storeId = getEventStoreId(payload);
  const orderId = getEventOrderId(payload);
  const resourceHref = getSingleString(payload.resource_href);
  const reason = getCancellationOrFailureReason(payload);
  const meta = getPayloadMeta(payload);

  printDivider("EVENTO orders.cancel / orders.cancelled", "red");
  printKeyValue("event_id", payload.event_id || "N/A", "red");
  printKeyValue("event_type", payload.event_type || "N/A", "red");
  printKeyValue("event_status", eventStatus || "N/A", "red");
  printKeyValue("store_id", storeId || "N/A", "red");
  printKeyValue("order_id", orderId || "N/A", "red");
  printKeyValue("resource_href", resourceHref || "N/A", "red");
  printKeyValue("reason", reason || "N/A", "red");

  return createSummary({
    status,
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    eventStatus,
    storeId,
    orderId,
    resourceHref,
    cancellationReason: reason,
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
    note: createCancelFailureNote({
      baseNote: "Cancel Notification Handling: webhook de cancelación recibido y confirmado con ACK 200",
      payload
    })
  });
}

async function processOrdersScheduledNotification(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const status: WebhookProcessingStatus =
    "scheduled_order_notification_webhook_received";

  const eventStatus = getEventStatus(payload);
  const storeId = getEventStoreId(payload);
  const orderId = getEventOrderId(payload);
  const resourceHref = getSingleString(payload.resource_href);
  const scheduledPickupTime = getScheduledPickupTime(payload);
  const meta = getPayloadMeta(payload);

  printDivider("EVENTO orders.scheduled.notification", "cyan");
  printKeyValue("event_id", payload.event_id || "N/A", "cyan");
  printKeyValue("event_type", payload.event_type || "N/A", "cyan");
  printKeyValue("event_status", eventStatus || "N/A", "cyan");
  printKeyValue("store_id", storeId || "N/A", "cyan");
  printKeyValue("order_id", orderId || "N/A", "cyan");
  printKeyValue("resource_href", resourceHref || "N/A", "cyan");
  printKeyValue("scheduled_pickup_time", scheduledPickupTime || "N/A", "cyan");

  const noteParts = [
    "Scheduled Order Notification: webhook orders.scheduled.notification recibido y confirmado con ACK 200"
  ];

  if (eventStatus) {
    noteParts.push(`status=${eventStatus}`);
  }

  if (scheduledPickupTime) {
    noteParts.push(`scheduled_pickup_time=${scheduledPickupTime}`);
  }

  return createSummary({
    status,
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    eventStatus,
    storeId,
    orderId,
    resourceHref,
    scheduledOrder: true,
    scheduledPickupTime,
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
    note: noteParts.join(" | ")
  });
}

async function processOrdersRelease(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const meta = getPayloadMeta(payload);

  printDivider("EVENTO orders.release", "cyan");

  return createSummary({
    status: "order_release_webhook_received",
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    eventStatus: getEventStatus(payload),
    storeId: getEventStoreId(payload),
    orderId: getEventOrderId(payload),
    resourceHref: getSingleString(payload.resource_href),
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
    note: "Webhook de release recibido"
  });
}

async function processStoreProvisioned(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const meta = getPayloadMeta(payload);

  return createSummary({
    status: "store_provisioned_webhook_received",
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    eventStatus: getEventStatus(payload),
    storeId: getEventStoreId(payload),
    orderId: getEventOrderId(payload),
    resourceHref: getSingleString(payload.resource_href),
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
    note: "Store provisioned webhook recibido"
  });
}

async function processStoreDeprovisioned(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const meta = getPayloadMeta(payload);

  return createSummary({
    status: "store_deprovisioned_webhook_received",
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    eventStatus: getEventStatus(payload),
    storeId: getEventStoreId(payload),
    orderId: getEventOrderId(payload),
    resourceHref: getSingleString(payload.resource_href),
    rawMeta: Object.keys(meta).length > 0 ? meta : null,
    note: "Store deprovisioned webhook recibido"
  });
}

async function processOtherWebhookEvent(
  payload: UberWebhookEvent
): Promise<WebhookDiagnosticSummary> {
  const eventType = payload.event_type ?? "N/A";
  const eventTypeLower = eventType.toLowerCase();
  const eventStatus = getEventStatus(payload);
  const meta = getPayloadMeta(payload);

  /**
   * Primero detectamos cancelaciones por nombre de evento,
   * aunque Uber cambie entre orders.cancel, orders.cancelled,
   * orders.canceled, order.cancel, etc.
   */
  if (eventTypeLower.includes("cancel")) {
    return processOrdersCancel(payload);
  }

  if (eventTypeLower.includes("failure") || eventTypeLower.includes("failed")) {
    return processOrdersFailure(payload);
  }

  /**
   * También detectamos cancelaciones/fallas por status,
   * incluso si el event_type llega como orders.notification.
   */
  if (isCancellationStatus(eventStatus)) {
    return processOrdersCancel(payload);
  }

  if (isFailureStatus(eventStatus)) {
    return processOrdersFailure(payload);
  }

  /**
   * Scheduled Order Notification:
   * Esto evita que orders.scheduled.notification caiga como ignored_event.
   */
  if (isScheduledOrderPayload(payload)) {
    return processOrdersScheduledNotification(payload);
  }

  switch (payload.event_type) {
    case "orders.notification":
      return processOrdersNotification(payload);

    case "orders.failure":
      return processOrdersFailure(payload);

    case "orders.cancel":
    case "orders.canceled":
    case "orders.cancelled":
    case "order.cancel":
    case "order.canceled":
    case "order.cancelled":
    case "orders.cancel.notification":
    case "orders.canceled.notification":
    case "orders.cancelled.notification":
      return processOrdersCancel(payload);

    case "orders.scheduled.notification":
    case "order.scheduled.notification":
    case "orders.scheduled":
    case "order.scheduled":
      return processOrdersScheduledNotification(payload);

    case "orders.release":
      return processOrdersRelease(payload);

    case "store.provisioned":
      return processStoreProvisioned(payload);

    case "store.deprovisioned":
      return processStoreDeprovisioned(payload);

    case "delivery.state_changed":
    case "order.fulfillment_issues.resolved":
    default:
      console.log(chalk.yellow(`Evento recibido pero no procesado todavía: ${payload.event_type}`));

      return createSummary({
        status: "ignored_event",
        eventType: payload.event_type ?? "N/A",
        eventId: payload.event_id ?? null,
        eventStatus,
        storeId: getEventStoreId(payload),
        orderId: getEventOrderId(payload),
        resourceHref: getSingleString(payload.resource_href),
        rawMeta: Object.keys(meta).length > 0 ? meta : null,
        note: "Evento recibido y confirmado con 200, pero sin lógica adicional todavía"
      });
  }
}

export async function handleUberWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  const rawBodyText = rawBody.toString("utf8");
  const signatureHeader = req.header("X-Uber-Signature");
  const environment = getSingleString(req.header("X-Environment"));

  printDivider("WEBHOOK DE UBER RECIBIDO", "blue");
  printKeyValue("Timestamp", new Date().toISOString(), "white");
  printKeyValue("Método", req.method, "white");
  printKeyValue("URL", req.originalUrl, "white");
  printKeyValue("Content-Type", req.header("content-type") ?? "N/A", "white");
  printKeyValue("X-Uber-Signature presente", signatureHeader ? "Sí" : "No", "white");
  printKeyValue("Raw body length", rawBody.length, "white");
  console.log(chalk.blue("Headers completos:"));
  console.log(req.headers);
  console.log(chalk.blue("Raw body (texto):"));
  console.log(rawBodyText || "[vacío]");

  const baseSummary = createSummary({
    signaturePresent: Boolean(signatureHeader && signatureHeader.trim() !== ""),
    environment
  });

  if (rawBody.length === 0) {
    res.status(200).end();

    persistAndPrintSummary(
      createSummary({
        ...baseSummary,
        status: "empty_body",
        responded200: true,
        note: "Webhook con body vacío"
      })
    );

    return;
  }

  if (signatureHeader && signatureHeader.trim() !== "") {
    const signatureValid = verifyWithAnySigningKey(rawBody, signatureHeader);

    if (!signatureValid) {
      console.error(chalk.red("Firma HMAC-SHA256 inválida"));

      res.status(200).end();

      persistAndPrintSummary(
        createSummary({
          ...baseSummary,
          status: "invalid_signature",
          signatureValid: false,
          responded200: true,
          note: "Firma inválida; se respondió 200 para evitar reintentos infinitos"
        })
      );

      return;
    }

    console.log(chalk.green("✓ Firma del webhook válida"));
  } else {
    console.log(chalk.yellow("⚠️ Prueba manual detectada - Firma omitida"));
  }

  let payload: UberWebhookEvent;

  try {
    payload = safeJsonParse<UberWebhookEvent>(rawBody);
  } catch (error: unknown) {
    console.error(chalk.red("No se pudo parsear el JSON del webhook"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));

    res.status(200).end();

    persistAndPrintSummary(
      createSummary({
        ...baseSummary,
        status: "invalid_json",
        signatureValid:
          signatureHeader && signatureHeader.trim() !== "" ? true : null,
        responded200: true,
        note: "Body recibido pero JSON inválido"
      })
    );

    return;
  }

  console.log(chalk.magenta("Payload completo del webhook:"));
  console.log(JSON.stringify(payload, null, 2));

  /**
   * Muy importante:
   * Respondemos 200 inmediatamente para cumplir el ACK de Uber.
   * Todo el procesamiento pesado se hace después.
   */
  res.status(200).end();
  console.log(chalk.green("✓ Respuesta 200 enviada a Uber correctamente"));

  void (async () => {
    try {
      const initialSummary = createSummary({
        ...baseSummary,
        status: "received",
        eventType: payload.event_type ?? "N/A",
        eventId: payload.event_id ?? null,
        eventStatus: getEventStatus(payload),
        storeId: getEventStoreId(payload),
        orderId: getEventOrderId(payload),
        resourceHref: getSingleString(payload.resource_href),
        signatureValid:
          signatureHeader && signatureHeader.trim() !== "" ? true : null,
        responded200: true,
        rawMeta: getPayloadMeta(payload),
        note: "Webhook recibido y confirmado con 200"
      });

      persistAndPrintSummary(initialSummary);

      const finalSummary = await processOtherWebhookEvent(payload);

      finalSummary.signaturePresent = initialSummary.signaturePresent;
      finalSummary.signatureValid = initialSummary.signatureValid;
      finalSummary.responded200 = true;
      finalSummary.environment = initialSummary.environment;
      finalSummary.receivedAt = new Date().toISOString();

      persistAndPrintSummary(finalSummary);
    } catch (error: unknown) {
      console.error(chalk.red("Error procesando el webhook:"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));

      persistAndPrintSummary(
        createSummary({
          ...baseSummary,
          status: "processing_error",
          responded200: true,
          note: error instanceof Error ? error.message : "Error desconocido procesando webhook"
        })
      );
    }
  })();
}

export function getLastUberWebhookState(_req: Request, res: Response): void {
  res.status(200).json({
    ok: true,
    message: "Último estado del webhook obtenido correctamente",
    data: getLastWebhookState()
  });
}

export function getUberWebhookHistory(req: Request, res: Response): void {
  const limit =
    typeof req.query.limit === "string" && req.query.limit.trim() !== ""
      ? Number(req.query.limit)
      : 20;

  res.status(200).json({
    ok: true,
    message: "Historial de webhooks obtenido correctamente",
    data: getWebhookHistory(limit)
  });
}

export function clearUberWebhookHistoryHandler(_req: Request, res: Response): void {
  const result = clearWebhookHistory();

  res.status(200).json({
    ok: true,
    message: "Historial de webhooks limpiado correctamente",
    data: result
  });
}

export function getUberWebhookEvidenceHandler(_req: Request, res: Response): void {
  const publicUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    null;

  res.status(200).json({
    ok: true,
    message: "Evidencia técnica del webhook obtenida correctamente",
    data: {
      public_url: publicUrl,
      webhook_url: publicUrl ? `${publicUrl}/webhooks/uber/webhook` : null,
      auto_accept_orders: process.env.AUTO_ACCEPT_ORDERS === "true",
      signing_keys_configured: getWebhookSigningKeys().length,
      ...getWebhookEvidence()
    }
  });
}