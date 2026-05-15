import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import {
  getUberPromotionsService,
  UberCreatePromotionPayload,
  UberListPromotionsQuery
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
): UberCreatePromotionPayload | null {
  if (!isNonArrayObject(body)) {
    return null;
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.start_time !== "string") {
    return null;
  }

  if (typeof payload.end_time !== "string") {
    return null;
  }

  if (typeof payload.user_group !== "string") {
    return null;
  }

  if (typeof payload.promo_type !== "string") {
    return null;
  }

  if (!isNonArrayObject(payload.budget)) {
    return null;
  }

  return payload as UberCreatePromotionPayload;
}

function normalizeListPromotionsQuery(req: Request): UberListPromotionsQuery {
  const query: UberListPromotionsQuery = {};

  if (typeof req.query.state === "string") {
    query.state = req.query.state;
  }

  if (typeof req.query.time_range === "string") {
    query.time_range = req.query.time_range;
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
        message:
          "El body de la promoción es inválido. Debe incluir start_time, end_time, user_group, budget y promo_type"
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

export async function getPromotionDetails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const promotionId = requireValidPromotionId(req, res);

    if (!promotionId) {
      return;
    }

    const result = await getUberPromotionsService().getPromotionDetails(
      promotionId
    );

    return void res.status(200).json({
      ok: true,
      message: "Detalle de promoción obtenido correctamente",
      data: {
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
        promotionId: req.params.promotionId ?? null
      }
    );
  }
}

export async function revokePromotion(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const promotionId = requireValidPromotionId(req, res);

    if (!promotionId) {
      return;
    }

    const result = await getUberPromotionsService().revokePromotion(
      promotionId
    );

    return void res.status(200).json({
      ok: true,
      message: "Promoción revocada correctamente",
      data: {
        promotion_id: promotionId,
        uber_response: result
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible revocar la promoción",
      error,
      {
        promotionId: req.params.promotionId ?? null
      }
    );
  }
}