import { Request, Response } from "express";
import chalk from "chalk";
import { getUberApiService } from "../services/uberApi";
import {
  UberCartItem,
  UberModifierGroup,
  UberOrderDetails,
  UberWebhookEvent,
} from "../types/uber";
import { verifyUberSignature } from "../utils/signature";

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

function formatMoney(formatted?: string, amount?: number, currency?: string): string {
  if (formatted) return formatted;
  if (typeof amount === "number") return `${(amount / 100).toFixed(2)} ${currency ?? ""}`.trim();
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
    location.business_name ? `Referencia: ${location.business_name}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "No disponible / pedido no expone dirección";
}

function printModifierGroups(groups?: UberModifierGroup[] | null, indent = "    "): void {
  if (!groups || groups.length === 0) return;

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
  const customerName = [order.eater?.first_name, order.eater?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "No disponible";

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
  console.log(chalk.white(`Total: ${formatMoney(total?.formatted_amount, total?.amount, total?.currency_code)}`));

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
        `- ${qty} x ${title} (${formatMoney(price?.formatted_amount, price?.amount, price?.currency_code)})`
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

export async function handleUberWebhook(req: Request, res: Response): Promise<void> {
  const clientSecret = process.env.UBER_CLIENT_SECRET;

  if (!clientSecret) {
    console.error(chalk.red("ERROR: Falta UBER_CLIENT_SECRET en .env"));
    res.status(200).end();
    return;
  }

  // rawBody debe ser Buffer gracias al middleware express.raw()
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const signatureHeader = req.header("X-Uber-Signature");

  const isValidSignature = verifyUberSignature({
    rawBody,
    clientSecret,
    signatureHeader,
  });

  if (!isValidSignature) {
    console.error(chalk.red("Firma HMAC-SHA256 inválida - Posible ataque o secreto incorrecto"));
    res.status(200).end();
    return;
  }

  let payload: UberWebhookEvent;
  try {
    payload = safeJsonParse<UberWebhookEvent>(rawBody);
  } catch (err) {
    console.error(chalk.red("No se pudo parsear el JSON del webhook"));
    res.status(200).end();
    return;
  }

  // Responder inmediatamente (obligatorio para Uber)
  res.status(200).end();

  // Procesamiento asíncrono
  void (async () => {
    try {
      console.log(chalk.gray(`Webhook recibido → ${payload.event_type} | Event ID: ${payload.event_id}`));

      if (payload.event_type !== "orders.notification") {
        console.log(chalk.yellow(`Evento ignorado: ${payload.event_type}`));
        return;
      }

      // Obtener orderId (dos posibles ubicaciones)
      let orderId = getSingleString(payload.meta?.resource_id);
      if (!orderId && payload.resource_href) {
        // fallback: extraer del href si es necesario
        const match = payload.resource_href.match(/order\/(.+)$/);
        orderId = match ? match[1] : null;
      }

      if (!orderId) {
        console.error(chalk.red("No se encontró order_id en el webhook"));
        return;
      }

      const uberApiService = getUberApiService();
      console.log(chalk.blue(`Obteniendo detalles del pedido: ${orderId}`));

      const order = await uberApiService.getOrderDetails(orderId);

      printOrderSummary(order);

      const autoAccept = process.env.AUTO_ACCEPT_ORDERS === "true";

      if (autoAccept) {
        console.log(chalk.green("Auto-aceptando pedido..."));
        await uberApiService.acceptOrder(orderId);
        console.log(chalk.green("Pedido aceptado automáticamente"));
      } else {
        console.log(chalk.yellow("AUTO_ACCEPT_ORDERS=false → Pedido NO aceptado automáticamente"));
      }
    } catch (error: unknown) {
      console.error(chalk.red("Error procesando el webhook:"));
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      } else {
        console.error(chalk.red(String(error)));
      }
    }
  })();
}

// Endpoint manual útil para pruebas
export async function getOrderDetailsManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = getSingleString(req.params.orderId);
    if (!orderId) {
      res.status(400).json({ ok: false, message: "orderId es requerido" });
      return;
    }

    const uberApiService = getUberApiService();
    const order = await uberApiService.getOrderDetails(orderId);

    res.status(200).json({
      ok: true,
      message: "Pedido obtenido correctamente",
      data: order,
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error en getOrderDetailsManually:"), error);
    res.status(500).json({
      ok: false,
      message: "No se pudo obtener el pedido",
    });
  }
}