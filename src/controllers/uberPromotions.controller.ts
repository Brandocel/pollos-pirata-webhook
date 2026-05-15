import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import {
  getUberPromotionsService,
  UberPromotionCreatePayload,
  UberPromotionListQuery
} from "../services/uberPromotions.service";

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

function requireValidPromotionId(req: Request, res: Response): string | null {
  const { promotionId } = req.params;

  if (!promotionId || Array.isArray(promotionId)) {
    res.status(400).json({
      ok: false,
      message: "Falta el promotionId o el formato es inválido"
    });

    return null;
  }

  return promotionId;
}

function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCreatePromotionPayload(
  body: unknown
): UberPromotionCreatePayload | null {
  if (!isNonArrayObject(body)) {
    return null;
  }

  return body as UberPromotionCreatePayload;
}

function normalizeListPromotionsQuery(req: Request): UberPromotionListQuery {
  const query: UberPromotionListQuery = {};

  if (typeof req.query.status === "string") {
    query.status = req.query.status;
  }

  if (typeof req.query.page_token === "string") {
    query.page_token = req.query.page_token;
  }

  if (typeof req.query.page_size === "string") {
    const pageSize = Number(req.query.page_size);

    if (Number.isFinite(pageSize) && pageSize > 0) {
      query.page_size = pageSize;
    }
  }

  return query;
}

export async function createStorePromotion(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const payload = normalizeCreatePromotionPayload(req.body);

    if (!payload) {
      return void res.status(400).json({
        ok: false,
        message: "El body de la promoción debe ser un objeto JSON válido"
      });
    }

    const result = await getUberPromotionsService().createStorePromotion(
      storeId,
      payload
    );

    return void res.status(200).json({
      ok: true,
      message: "Promoción creada correctamente",
      data: {
        store_id: storeId,
        uber_response: result,
        submitted_payload: payload
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible crear la promoción de la store",
      error,
      {
        storeId: req.params.storeId ?? null,
        requestBody: req.body ?? null
      }
    );
  }
}

export async function listStorePromotions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const query = normalizeListPromotionsQuery(req);
    const result = await getUberPromotionsService().listStorePromotions(
      storeId,
      query
    );

    return void res.status(200).json({
      ok: true,
      message: "Promociones obtenidas correctamente",
      data: {
        store_id: storeId,
        query,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener las promociones de la store",
      error,
      {
        storeId: req.params.storeId ?? null,
        query: req.query ?? null
      }
    );
  }
}

export async function getStorePromotionDetails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);
    const promotionId = requireValidPromotionId(req, res);

    if (!storeId || !promotionId) {
      return;
    }

    const result = await getUberPromotionsService().getStorePromotionDetails(
      storeId,
      promotionId
    );

    return void res.status(200).json({
      ok: true,
      message: "Detalle de promoción obtenido correctamente",
      data: {
        store_id: storeId,
        promotion_id: promotionId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener el detalle de la promoción",
      error,
      {
        storeId: req.params.storeId ?? null,
        promotionId: req.params.promotionId ?? null
      }
    );
  }
}

export async function revokeStorePromotion(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);
    const promotionId = requireValidPromotionId(req, res);

    if (!storeId || !promotionId) {
      return;
    }

    const payload = isNonArrayObject(req.body) ? req.body : {};

    const result = await getUberPromotionsService().revokeStorePromotion(
      storeId,
      promotionId,
      payload
    );

    return void res.status(200).json({
      ok: true,
      message: "Promoción revocada correctamente",
      data: {
        store_id: storeId,
        promotion_id: promotionId,
        uber_response: result,
        submitted_payload: payload
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible revocar la promoción",
      error,
      {
        storeId: req.params.storeId ?? null,
        promotionId: req.params.promotionId ?? null,
        requestBody: req.body ?? null
      }
    );
  }
}