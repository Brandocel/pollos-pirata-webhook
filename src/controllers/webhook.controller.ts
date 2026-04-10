import { Request, Response } from "express";
import chalk from "chalk";
import { getUberApiService } from "../services/uberApi";
import {
  UberCartItem,
  UberModifierGroup,
  UberOrderDetails,
  UberWebhookEvent
} from "../types/uber";
import { verifyUberSignature } from "../utils/signature";

type WebhookProcessingStatus =
  | "received"
  | "empty_body"
  | "invalid_signature"
  | "invalid_json"
  | "ignored_event"
  | "invalid_order_id"
  | "order_fetched"
  | "auto_accepted"
  | "manual_pending"
  | "processing_error";

interface WebhookDiagnosticSummary {
  status: WebhookProcessingStatus;
  eventType: string;
  eventId: string | null;
  storeId: string | null;
  orderId: string | null;
  resourceHref: string | null;
  signaturePresent: boolean;
  signatureValid: boolean | null;
  responded200: boolean;
}

function safeJsonParse<T>(rawBody: Buffer): T {
  return JSON.parse(rawBody.toString("utf8")) as T;
}

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

function extractOrderIdFromResourceHref(resourceHref?: string | null): string | null {
  if (!resourceHref || typeof resourceHref !== "string") {
    return null;
  }

  const match = resourceHref.match(/\/order\/([^/?#]+)/i);
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

function printDivider(title: string, color: "blue" | "green" | "yellow" | "red" | "cyan" = "blue"): void {
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
            : chalk.blue;

  console.log(printer(line));
  console.log(printer(` ${title}`));
  console.log(printer(line));
}

function printKeyValue(label: string, value: unknown, color: "white" | "gray" | "green" | "yellow" | "red" | "cyan" = "white"): void {
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

function getEventStoreId(payload: UberWebhookEvent): string | null {
  return getSingleString(payload.meta?.user_id);
}

function getEventOrderId(payload: UberWebhookEvent): string | null {
  const resourceId = getSingleString(payload.meta?.resource_id);
  if (resourceId) {
    return resourceId;
  }

  return extractOrderIdFromResourceHref(getSingleString(payload.resource_href));
}

function createSummary(partial?: Partial<WebhookDiagnosticSummary>): WebhookDiagnosticSummary {
  return {
    status: partial?.status ?? "received",
    eventType: partial?.eventType ?? "N/A",
    eventId: partial?.eventId ?? null,
    storeId: partial?.storeId ?? null,
    orderId: partial?.orderId ?? null,
    resourceHref: partial?.resourceHref ?? null,
    signaturePresent: partial?.signaturePresent ?? false,
    signatureValid: partial?.signatureValid ?? null,
    responded200: partial?.responded200 ?? false
  };
}

function printWebhookSummary(summary: WebhookDiagnosticSummary): void {
  printDivider("RESUMEN WEBHOOK", "cyan");
  printKeyValue("status", summary.status, "cyan");
  printKeyValue("eventType", summary.eventType, "white");
  printKeyValue("eventId", summary.eventId ?? "N/A", "white");
  printKeyValue("storeId", summary.storeId ?? "N/A", "white");
  printKeyValue("orderId", summary.orderId ?? "N/A", "white");
  printKeyValue("resourceHref", summary.resourceHref ?? "N/A", "white");
  printKeyValue("signaturePresent", summary.signaturePresent ? "Sí" : "No", "white");
  printKeyValue(
    "signatureValid",
    summary.signatureValid === null ? "No evaluada" : summary.signatureValid ? "Sí" : "No",
    summary.signatureValid === false ? "red" : "white"
  );
  printKeyValue("responded200", summary.responded200 ? "Sí" : "No", summary.responded200 ? "green" : "red");
}

async function processOrdersNotification(payload: UberWebhookEvent): Promise<WebhookDiagnosticSummary> {
  const orderId = getEventOrderId(payload);
  const storeId = getEventStoreId(payload);

  printDivider("PROCESANDO orders.notification", "gray" as never);
  printKeyValue("event_id", payload.event_id || "N/A", "gray");
  printKeyValue("event_type", payload.event_type || "N/A", "gray");
  printKeyValue("store_id(meta.user_id)", storeId || "N/A", "gray");
  printKeyValue("resource_id(meta.resource_id)", payload.meta?.resource_id || "N/A", "gray");
  printKeyValue("resource_href", payload.resource_href || "N/A", "gray");
  printKeyValue("order_id resuelto", orderId || "N/A", "gray");

  if (!orderId) {
    console.error(chalk.red("No se encontró order_id en el webhook"));
    return createSummary({
      status: "invalid_order_id",
      eventType: payload.event_type ?? "N/A",
      eventId: payload.event_id ?? null,
      storeId,
      orderId: null,
      resourceHref: getSingleString(payload.resource_href)
    });
  }

  if (!looksLikeUuid(orderId)) {
    console.error(chalk.red(`El order_id recibido no tiene formato UUID válido: ${orderId}`));
    return createSummary({
      status: "invalid_order_id",
      eventType: payload.event_type ?? "N/A",
      eventId: payload.event_id ?? null,
      storeId,
      orderId,
      resourceHref: getSingleString(payload.resource_href)
    });
  }

  console.log(chalk.blue(`Obteniendo detalles del pedido → ${orderId}`));

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
      storeId,
      orderId,
      resourceHref: getSingleString(payload.resource_href)
    });
  }

  console.log(
    chalk.yellow("AUTO_ACCEPT_ORDERS=false → Pedido queda pendiente de aceptación manual")
  );

  return createSummary({
    status: "manual_pending",
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    storeId,
    orderId,
    resourceHref: getSingleString(payload.resource_href)
  });
}

async function processOrdersFailure(payload: UberWebhookEvent): Promise<WebhookDiagnosticSummary> {
  printDivider("EVENTO orders.failure", "red");
  printKeyValue("event_id", payload.event_id || "N/A", "red");
  printKeyValue("resource_id", payload.meta?.resource_id || "N/A", "red");
  printKeyValue("store_id", payload.meta?.user_id || "N/A", "red");
  printKeyValue("resource_href", payload.resource_href || "N/A", "red");

  return createSummary({
    status: "ignored_event",
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    storeId: getEventStoreId(payload),
    orderId: getEventOrderId(payload),
    resourceHref: getSingleString(payload.resource_href)
  });
}

async function processDeliveryStateChanged(payload: UberWebhookEvent): Promise<WebhookDiagnosticSummary> {
  printDivider("EVENTO delivery.state_changed", "cyan");
  printKeyValue("event_id", payload.event_id || "N/A", "cyan");
  printKeyValue("resource_id", payload.meta?.resource_id || "N/A", "cyan");
  printKeyValue("store_id", payload.meta?.user_id || "N/A", "cyan");
  printKeyValue("resource_href", payload.resource_href || "N/A", "cyan");

  return createSummary({
    status: "ignored_event",
    eventType: payload.event_type ?? "N/A",
    eventId: payload.event_id ?? null,
    storeId: getEventStoreId(payload),
    orderId: getEventOrderId(payload),
    resourceHref: getSingleString(payload.resource_href)
  });
}

async function processOtherWebhookEvent(payload: UberWebhookEvent): Promise<WebhookDiagnosticSummary> {
  switch (payload.event_type) {
    case "orders.notification":
      return processOrdersNotification(payload);

    case "orders.failure":
      return processOrdersFailure(payload);

    case "delivery.state_changed":
      return processDeliveryStateChanged(payload);

    case "orders.scheduled.notification":
    case "orders.release":
    case "orders.fulfillment_issues.resolved":
      console.log(chalk.yellow(`Evento recibido pero no procesado todavía: ${payload.event_type}`));
      console.log(chalk.yellow(`resource_id: ${payload.meta?.resource_id || "N/A"}`));
      console.log(chalk.yellow(`resource_href: ${payload.resource_href || "N/A"}`));

      return createSummary({
        status: "ignored_event",
        eventType: payload.event_type ?? "N/A",
        eventId: payload.event_id ?? null,
        storeId: getEventStoreId(payload),
        orderId: getEventOrderId(payload),
        resourceHref: getSingleString(payload.resource_href)
      });

    default:
      console.log(chalk.yellow(`Evento ignorado/no reconocido: ${payload.event_type}`));
      console.log(chalk.yellow(`Payload: ${JSON.stringify(payload, null, 2)}`));

      return createSummary({
        status: "ignored_event",
        eventType: payload.event_type ?? "N/A",
        eventId: payload.event_id ?? null,
        storeId: getEventStoreId(payload),
        orderId: getEventOrderId(payload),
        resourceHref: getSingleString(payload.resource_href)
      });
  }
}

export async function handleUberWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  const rawBodyText = rawBody.toString("utf8");
  const signatureHeader = req.header("X-Uber-Signature");

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
    signaturePresent: Boolean(signatureHeader && signatureHeader.trim() !== "")
  });

  if (rawBody.length === 0) {
    console.log(chalk.yellow("Webhook recibido con body vacío"));
    res.status(200).end();

    const summary = createSummary({
      ...baseSummary,
      status: "empty_body",
      responded200: true
    });

    console.log(chalk.green("✓ Respuesta 200 enviada por body vacío"));
    printWebhookSummary(summary);
    return;
  }

  if (signatureHeader && signatureHeader.trim() !== "") {
    const signatureValid = verifyWithAnySigningKey(rawBody, signatureHeader);

    if (!signatureValid) {
      console.error(chalk.red("Firma HMAC-SHA256 inválida"));
      console.error(
        chalk.red(
          "Revisa que UBER_WEBHOOK_SIGNING_KEY coincida exactamente con el Signing Key del dashboard"
        )
      );

      res.status(200).end();

      const summary = createSummary({
        ...baseSummary,
        status: "invalid_signature",
        signatureValid: false,
        responded200: true
      });

      console.log(chalk.green("✓ Respuesta 200 enviada después de firma inválida"));
      printWebhookSummary(summary);
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

    const summary = createSummary({
      ...baseSummary,
      status: "invalid_json",
      signatureValid:
        signatureHeader && signatureHeader.trim() !== "" ? true : null,
      responded200: true
    });

    console.log(chalk.green("✓ Respuesta 200 enviada después de JSON inválido"));
    printWebhookSummary(summary);
    return;
  }

  console.log(chalk.magenta("Payload completo del webhook:"));
  console.log(JSON.stringify(payload, null, 2));

  res.status(200).end();
  console.log(chalk.green("✓ Respuesta 200 enviada a Uber correctamente"));

  void (async () => {
    try {
      const initialSummary = createSummary({
        ...baseSummary,
        status: "received",
        eventType: payload.event_type ?? "N/A",
        eventId: payload.event_id ?? null,
        storeId: getEventStoreId(payload),
        orderId: getEventOrderId(payload),
        resourceHref: getSingleString(payload.resource_href),
        signatureValid:
          signatureHeader && signatureHeader.trim() !== "" ? true : null,
        responded200: true
      });

      printWebhookSummary(initialSummary);

      console.log(
        chalk.gray(
          `Webhook recibido → ${payload.event_type} | Event ID: ${payload.event_id || "N/A"}`
        )
      );

      const finalSummary = await processOtherWebhookEvent(payload);
      finalSummary.signaturePresent = initialSummary.signaturePresent;
      finalSummary.signatureValid = initialSummary.signatureValid;
      finalSummary.responded200 = true;

      printWebhookSummary(finalSummary);
    } catch (error: unknown) {
      console.error(chalk.red("Error procesando el webhook:"));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));

      const errorSummary = createSummary({
        ...baseSummary,
        status: "processing_error",
        responded200: true
      });

      printWebhookSummary(errorSummary);
    }
  })();
}

export async function getOrderDetailsManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = getSingleString(req.params.orderId);

    if (!orderId) {
      res.status(400).json({
        ok: false,
        message: "orderId es requerido"
      });
      return;
    }

    if (!looksLikeUuid(orderId)) {
      res.status(400).json({
        ok: false,
        message: "orderId debe tener formato UUID válido"
      });
      return;
    }

    const uberApiService = getUberApiService();
    const order = await uberApiService.getOrderDetails(orderId);

    res.status(200).json({
      ok: true,
      message: "Pedido obtenido correctamente",
      data: order
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error en getOrderDetailsManually:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));

    res.status(500).json({
      ok: false,
      message: "No se pudo obtener el pedido"
    });
  }
}