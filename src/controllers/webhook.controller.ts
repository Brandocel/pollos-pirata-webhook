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

function safeJsonParse<T>(rawBody: Buffer): T {
  return JSON.parse(rawBody.toString("utf8")) as T;
}

function getSingleString(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    const firstString = value.find((item) => typeof item === "string" && item.trim().length > 0);
    return typeof firstString === "string" ? firstString.trim() : null;
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
    location.business_name ? `Referencia: ${location.business_name}` : undefined
  ].filter(Boolean);

  if (parts.length === 0) {
    return "No disponible / pedido no expone dirección";
  }

  return parts.join(" | ");
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
        console.log(chalk.yellow(`${indent}  Nota modificador: ${selected.special_instructions}`));
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
  console.log(chalk.bgGreen.black("       Nuevo pedido Pollos Pirata"));
  console.log(chalk.bgGreen.black("=============================================="));
  console.log(chalk.white(`Orden: ${chalk.bold(orderNumber)}`));
  console.log(chalk.white(`Order ID: ${order.id}`));
  console.log(chalk.white(`Estado: ${order.current_state ?? "No disponible"}`));
  console.log(chalk.white(`Cliente: ${customerName}`));
  console.log(chalk.white(`Teléfono: ${phone}`));
  console.log(chalk.white(`Dirección: ${address}`));
  console.log(
    chalk.white(`Total: ${formatMoney(total?.formatted_amount, total?.amount, total?.currency_code)}`)
  );

  const orderInstructions = order.cart?.special_instructions?.trim();
  console.log(chalk.magenta(`Instrucciones generales: ${orderInstructions || "Ninguna"}`));

  console.log(chalk.blue("Items:"));
  const items: UberCartItem[] = order.cart?.items ?? [];

  if (items.length === 0) {
    console.log(chalk.yellow("- No se encontraron items"));
  }

  for (const item of items) {
    const quantity = item.quantity ?? 0;
    const title = item.title ?? "Item sin nombre";
    const itemPrice = item.price?.total_price;

    console.log(
      chalk.green(
        `- ${quantity} x ${title} (${formatMoney(
          itemPrice?.formatted_amount,
          itemPrice?.amount,
          itemPrice?.currency_code
        )})`
      )
    );

    if (item.special_instructions?.trim()) {
      console.log(chalk.yellow(`  Nota item: ${item.special_instructions.trim()}`));
    }

    if (item.special_requests?.length) {
      for (const request of item.special_requests) {
        const allergyInstructions = request.allergy?.allergy_instructions?.trim();
        const allergens = request.allergy?.allergens_to_exclude
          ?.map((a) => a.type || a.freeform_text)
          .filter(Boolean);

        if (allergyInstructions) {
          console.log(chalk.red(`  Alergias: ${allergyInstructions}`));
        }

        if (allergens && allergens.length > 0) {
          console.log(chalk.red(`  Excluir: ${allergens.join(", ")}`));
        }
      }
    }

    if (item.selected_modifier_groups?.length) {
      printModifierGroups(item.selected_modifier_groups, "  ");
    }
  }

  console.log(chalk.bgGreen.black("=============================================="));
}

export async function handleUberWebhook(req: Request, res: Response): Promise<void> {
  const clientSecret = process.env.UBER_CLIENT_SECRET;

  if (!clientSecret) {
    console.error(chalk.red("Falta UBER_CLIENT_SECRET en variables de entorno"));
    res.status(200).send("ok");
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
  const signatureHeader = req.header("X-Uber-Signature");

  const isValidSignature = verifyUberSignature({
    rawBody,
    clientSecret,
    signatureHeader
  });

  if (!isValidSignature) {
    console.error(chalk.red("Firma inválida en webhook de Uber"));
    res.status(200).send("ok");
    return;
  }

  let payload: UberWebhookEvent;

  try {
    payload = safeJsonParse<UberWebhookEvent>(rawBody);
  } catch {
    console.error(chalk.red("No se pudo parsear el body JSON del webhook"));
    res.status(200).send("ok");
    return;
  }

  res.status(200).send("ok");

  void (async () => {
    try {
      console.log(chalk.gray(`Webhook recibido: ${payload.event_type}`));
      console.log(chalk.gray(`Event ID: ${payload.event_id}`));

      if (payload.event_type !== "orders.notification") {
        console.log(chalk.yellow(`Evento ignorado: ${payload.event_type}`));
        return;
      }

      const orderId = getSingleString(payload.meta?.resource_id);

      if (!orderId) {
        console.error(chalk.red("El webhook no contiene meta.resource_id válido"));
        return;
      }

      const uberApiService = getUberApiService();
      const order = await uberApiService.getOrderDetails(orderId);

      printOrderSummary(order);

      const autoAcceptOrders = process.env.AUTO_ACCEPT_ORDERS === "true";

      if (autoAcceptOrders) {
        await uberApiService.acceptOrder(orderId);
      } else {
        console.log(
          chalk.yellow("AUTO_ACCEPT_ORDERS=false, el pedido no se aceptó automáticamente")
        );
      }
    } catch (error: unknown) {
      console.error(chalk.red("Error procesando webhook de Uber Eats"));

      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      } else {
        console.error(chalk.red("Error desconocido"));
      }
    }
  })();
}

export async function getOrderDetailsManually(req: Request, res: Response): Promise<void> {
  try {
    const orderId = getSingleString(req.params.orderId);

    if (!orderId) {
      res.status(400).json({
        ok: false,
        message: "Falta el orderId o no es válido"
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
    console.error(chalk.red("Error obteniendo pedido manualmente"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red("Error desconocido"));
    }

    res.status(500).json({
      ok: false,
      message: "No fue posible obtener el pedido"
    });
  }
}