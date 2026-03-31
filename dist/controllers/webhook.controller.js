"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUberWebhook = handleUberWebhook;
exports.getOrderDetailsManually = getOrderDetailsManually;
const chalk_1 = __importDefault(require("chalk"));
const uberApi_1 = require("../services/uberApi");
const signature_1 = require("../utils/signature");
function safeJsonParse(rawBody) {
    return JSON.parse(rawBody.toString("utf8"));
}
function getSingleString(value) {
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
function formatMoney(formatted, amount, currency) {
    if (formatted)
        return formatted;
    if (typeof amount === "number")
        return `${(amount / 100).toFixed(2)} ${currency ?? ""}`.trim();
    return "No disponible";
}
function getDeliveryAddress(order) {
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
function printModifierGroups(groups, indent = "    ") {
    if (!groups || groups.length === 0)
        return;
    for (const group of groups) {
        console.log(chalk_1.default.cyan(`${indent}Grupo: ${group.title ?? "Sin título"}`));
        for (const selected of group.selected_items ?? []) {
            const quantity = selected.quantity ?? 0;
            const title = selected.title ?? "Modificador sin nombre";
            console.log(chalk_1.default.cyan(`${indent}- ${quantity} x ${title}`));
            if (selected.special_instructions) {
                console.log(chalk_1.default.yellow(`${indent}  Nota modificador: ${selected.special_instructions}`));
            }
            if (selected.selected_modifier_groups?.length) {
                printModifierGroups(selected.selected_modifier_groups, `${indent}  `);
            }
        }
    }
}
function printOrderSummary(order) {
    const total = order.payment?.charges?.total;
    const customerName = [order.eater?.first_name, order.eater?.last_name].filter(Boolean).join(" ").trim() ||
        "No disponible";
    const phone = order.eater?.phone || "No disponible";
    const address = getDeliveryAddress(order);
    const orderNumber = order.display_id || order.external_reference_id || order.id;
    console.log(chalk_1.default.bgGreen.black("=============================================="));
    console.log(chalk_1.default.bgGreen.black("       Nuevo pedido Pollos Pirata"));
    console.log(chalk_1.default.bgGreen.black("=============================================="));
    console.log(chalk_1.default.white(`Orden: ${chalk_1.default.bold(orderNumber)}`));
    console.log(chalk_1.default.white(`Order ID: ${order.id}`));
    console.log(chalk_1.default.white(`Estado: ${order.current_state ?? "No disponible"}`));
    console.log(chalk_1.default.white(`Cliente: ${customerName}`));
    console.log(chalk_1.default.white(`Teléfono: ${phone}`));
    console.log(chalk_1.default.white(`Dirección: ${address}`));
    console.log(chalk_1.default.white(`Total: ${formatMoney(total?.formatted_amount, total?.amount, total?.currency_code)}`));
    const orderInstructions = order.cart?.special_instructions?.trim();
    console.log(chalk_1.default.magenta(`Instrucciones generales: ${orderInstructions || "Ninguna"}`));
    console.log(chalk_1.default.blue("Items:"));
    const items = order.cart?.items ?? [];
    if (items.length === 0) {
        console.log(chalk_1.default.yellow("- No se encontraron items"));
    }
    for (const item of items) {
        const quantity = item.quantity ?? 0;
        const title = item.title ?? "Item sin nombre";
        const itemPrice = item.price?.total_price;
        console.log(chalk_1.default.green(`- ${quantity} x ${title} (${formatMoney(itemPrice?.formatted_amount, itemPrice?.amount, itemPrice?.currency_code)})`));
        if (item.special_instructions?.trim()) {
            console.log(chalk_1.default.yellow(`  Nota item: ${item.special_instructions.trim()}`));
        }
        if (item.special_requests?.length) {
            for (const request of item.special_requests) {
                const allergyInstructions = request.allergy?.allergy_instructions?.trim();
                const allergens = request.allergy?.allergens_to_exclude
                    ?.map((a) => a.type || a.freeform_text)
                    .filter(Boolean);
                if (allergyInstructions) {
                    console.log(chalk_1.default.red(`  Alergias: ${allergyInstructions}`));
                }
                if (allergens && allergens.length > 0) {
                    console.log(chalk_1.default.red(`  Excluir: ${allergens.join(", ")}`));
                }
            }
        }
        if (item.selected_modifier_groups?.length) {
            printModifierGroups(item.selected_modifier_groups, "  ");
        }
    }
    console.log(chalk_1.default.bgGreen.black("=============================================="));
}
async function handleUberWebhook(req, res) {
    const clientSecret = process.env.UBER_CLIENT_SECRET;
    if (!clientSecret) {
        console.error(chalk_1.default.red("Falta UBER_CLIENT_SECRET en variables de entorno"));
        res.status(200).send("ok");
        return;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const signatureHeader = req.header("X-Uber-Signature");
    const isValidSignature = (0, signature_1.verifyUberSignature)({
        rawBody,
        clientSecret,
        signatureHeader
    });
    if (!isValidSignature) {
        console.error(chalk_1.default.red("Firma inválida en webhook de Uber"));
        res.status(200).send("ok");
        return;
    }
    let payload;
    try {
        payload = safeJsonParse(rawBody);
    }
    catch {
        console.error(chalk_1.default.red("No se pudo parsear el body JSON del webhook"));
        res.status(200).send("ok");
        return;
    }
    res.status(200).send("ok");
    void (async () => {
        try {
            console.log(chalk_1.default.gray(`Webhook recibido: ${payload.event_type}`));
            console.log(chalk_1.default.gray(`Event ID: ${payload.event_id}`));
            if (payload.event_type !== "orders.notification") {
                console.log(chalk_1.default.yellow(`Evento ignorado: ${payload.event_type}`));
                return;
            }
            const orderId = getSingleString(payload.meta?.resource_id);
            if (!orderId) {
                console.error(chalk_1.default.red("El webhook no contiene meta.resource_id válido"));
                return;
            }
            const uberApiService = (0, uberApi_1.getUberApiService)();
            const order = await uberApiService.getOrderDetails(orderId);
            printOrderSummary(order);
            const autoAcceptOrders = process.env.AUTO_ACCEPT_ORDERS === "true";
            if (autoAcceptOrders) {
                await uberApiService.acceptOrder(orderId);
            }
            else {
                console.log(chalk_1.default.yellow("AUTO_ACCEPT_ORDERS=false, el pedido no se aceptó automáticamente"));
            }
        }
        catch (error) {
            console.error(chalk_1.default.red("Error procesando webhook de Uber Eats"));
            if (error instanceof Error) {
                console.error(chalk_1.default.red(error.message));
            }
            else {
                console.error(chalk_1.default.red("Error desconocido"));
            }
        }
    })();
}
async function getOrderDetailsManually(req, res) {
    try {
        const orderId = getSingleString(req.params.orderId);
        if (!orderId) {
            res.status(400).json({
                ok: false,
                message: "Falta el orderId o no es válido"
            });
            return;
        }
        const uberApiService = (0, uberApi_1.getUberApiService)();
        const order = await uberApiService.getOrderDetails(orderId);
        res.status(200).json({
            ok: true,
            message: "Pedido obtenido correctamente",
            data: order
        });
    }
    catch (error) {
        console.error(chalk_1.default.red("Error obteniendo pedido manualmente"));
        if (error instanceof Error) {
            console.error(chalk_1.default.red(error.message));
        }
        else {
            console.error(chalk_1.default.red("Error desconocido"));
        }
        res.status(500).json({
            ok: false,
            message: "No fue posible obtener el pedido"
        });
    }
}
