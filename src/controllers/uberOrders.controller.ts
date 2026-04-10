import { Request, Response } from "express";
import chalk from "chalk";
import { getUberApiService } from "../services/uberApi";

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

export async function getOrderDetails(req: Request, res: Response): Promise<void> {
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

    console.log(chalk.green(`✓ Detalle de orden obtenido correctamente para ${orderId}`));

    res.status(200).json({
      ok: true,
      message: "Detalle de orden obtenido correctamente",
      data: order
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error en getOrderDetails:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));

    res.status(500).json({
      ok: false,
      message: "No fue posible obtener el detalle de la orden"
    });
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
    console.error(chalk.red("Error en listStoreOrders:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));

    res.status(500).json({
      ok: false,
      message: "No fue posible obtener las órdenes de la store"
    });
  }
}