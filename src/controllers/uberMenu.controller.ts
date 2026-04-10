import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import { getUberMenuService } from "../services/uberMenu.service";
import {
  UberMenuConfiguration,
  UberMenuType,
  UberUpdateMenuItemRequest
} from "../types/uber";

function sendDetailedError(
  res: Response,
  defaultMessage: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error(chalk.red(defaultMessage));

  if (error instanceof UberApiRequestError) {
    console.error(chalk.red(error.message));

    res.status(error.statusCode).json({
      ok: false,
      message: defaultMessage,
      error: {
        source: error.source,
        statusCode: error.statusCode,
        detail: error.message,
        requestUrl: error.requestUrl ?? null,
        response: error.details ?? null,
        context: context ?? null
      }
    });
    return;
  }

  if (error instanceof Error) {
    console.error(chalk.red(error.message));

    res.status(500).json({
      ok: false,
      message: defaultMessage,
      error: {
        source: "server",
        statusCode: 500,
        detail: error.message,
        requestUrl: null,
        response: null,
        context: context ?? null
      }
    });
    return;
  }

  res.status(500).json({
    ok: false,
    message: defaultMessage,
    error: {
      source: "server",
      statusCode: 500,
      detail: "Error desconocido",
      requestUrl: null,
      response: null,
      context: context ?? null
    }
  });
}

function requireValidStoreId(req: Request, res: Response): string | null {
  const { storeId } = req.params;

  if (!storeId || Array.isArray(storeId)) {
    res.status(400).json({
      ok: false,
      message: "Falta el storeId o el formato es inválido"
    });

    return null;
  }

  return storeId;
}

function requireValidItemId(req: Request, res: Response): string | null {
  const { itemId } = req.params;

  if (!itemId || Array.isArray(itemId)) {
    res.status(400).json({
      ok: false,
      message: "Falta el itemId o el formato es inválido"
    });

    return null;
  }

  return itemId;
}

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getMenuTypeFromQuery(req: Request): UberMenuType | undefined {
  const value = req.query.menu_type;

  if (typeof value !== "string") {
    return undefined;
  }

  const allowed: UberMenuType[] = [
    "MENU_TYPE_FULFILLMENT_DELIVERY",
    "MENU_TYPE_FULFILLMENT_PICK_UP",
    "MENU_TYPE_FULFILLMENT_DINE_IN"
  ];

  return allowed.includes(value as UberMenuType) ? (value as UberMenuType) : undefined;
}

function normalizeUploadMenuPayload(body: unknown): UberMenuConfiguration | null {
  if (!isNonArrayObject(body)) {
    return null;
  }

  const menus = body.menus;
  const categories = body.categories;
  const items = body.items;
  const modifier_groups = body.modifier_groups;
  const menu_type = body.menu_type;

  if (!Array.isArray(menus) || !Array.isArray(categories) || !Array.isArray(items)) {
    return null;
  }

  if (!Array.isArray(modifier_groups)) {
    return null;
  }

  return {
    menus: menus as Record<string, unknown>[],
    categories: categories as Record<string, unknown>[],
    items: items as Record<string, unknown>[],
    modifier_groups: modifier_groups as Record<string, unknown>[],
    menu_type: typeof menu_type === "string" ? (menu_type as UberMenuType) : undefined
  };
}

function normalizeUpdateItemPayload(body: unknown): UberUpdateMenuItemRequest | null {
  if (!isNonArrayObject(body)) {
    return null;
  }

  return body as UberUpdateMenuItemRequest;
}

export async function getMerchantStoreMenu(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const menuType = getMenuTypeFromQuery(req);
    const result = await getUberMenuService().getMenu(storeId, menuType);

    return void res.status(200).json({
      ok: true,
      message: "Menú obtenido correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener el menú de la store",
      error,
      {
        storeId: req.params.storeId ?? null,
        menu_type: req.query.menu_type ?? null
      }
    );
  }
}

export async function uploadMerchantStoreMenu(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const payload = normalizeUploadMenuPayload(req.body);

    if (!payload) {
      return void res.status(400).json({
        ok: false,
        message:
          "El body es inválido. Debe incluir menus, categories, items y modifier_groups como arreglos"
      });
    }

    await getUberMenuService().uploadMenu(storeId, payload);

    return void res.status(200).json({
      ok: true,
      message: "Menú cargado correctamente",
      data: {
        store_id: storeId,
        menu_type: payload.menu_type ?? "MENU_TYPE_FULFILLMENT_DELIVERY",
        submitted_payload: payload
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible cargar el menú de la store",
      error,
      {
        storeId: req.params.storeId ?? null,
        requestBody: req.body ?? null
      }
    );
  }
}

export async function updateMerchantStoreMenuItem(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);
    const itemId = requireValidItemId(req, res);

    if (!storeId || !itemId) {
      return;
    }

    const payload = normalizeUpdateItemPayload(req.body);

    if (!payload) {
      return void res.status(400).json({
        ok: false,
        message: "El body del update item debe ser un objeto JSON válido"
      });
    }

    await getUberMenuService().updateItem(storeId, itemId, payload);

    return void res.status(200).json({
      ok: true,
      message: "Item actualizado correctamente",
      data: {
        store_id: storeId,
        item_id: itemId,
        submitted_payload: payload
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible actualizar el item del menú",
      error,
      {
        storeId: req.params.storeId ?? null,
        itemId: req.params.itemId ?? null,
        requestBody: req.body ?? null
      }
    );
  }
}