import { Request, Response } from "express";
import chalk from "chalk";
import {
  UberApiRequestError,
  getUberActivationService
} from "../services/uberActivation.service";
import { getUberIntegrationService } from "../services/uberIntegration.service";
import { UberUpdateStoreIntegrationRequest } from "../types/uber";
import { readMerchantSessionToken } from "../utils/merchantSessionToken";

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

function getMerchantSessionTokenFromRequest(req: Request): string | null {
  const authorizationHeader = req.header("authorization");

  if (authorizationHeader?.startsWith("Bearer ")) {
    const token = authorizationHeader.replace("Bearer ", "").trim();

    if (token) {
      return token;
    }
  }

  const merchantSessionHeader = req.header("x-merchant-session-token");

  if (merchantSessionHeader?.trim()) {
    return merchantSessionHeader.trim();
  }

  const sessionQuery = req.query.sessionToken;

  if (typeof sessionQuery === "string" && sessionQuery.trim()) {
    return sessionQuery.trim();
  }

  return null;
}

/**
 * GET /uber/stores
 *
 * Requisito Uber:
 * Integration Config: Get stores to User
 *
 * Este endpoint usa el merchant session token generado después del OAuth login.
 * Internamente desencripta la sesión y usa el access_token del usuario/merchant
 * para llamar a Uber:
 *
 * GET /v1/eats/stores
 *
 * Importante:
 * - No usa app token/client_credentials.
 * - Debe usar token authorization_code del merchant con eats.pos_provisioning.
 */
export async function getStoresToUser(req: Request, res: Response): Promise<void> {
  try {
    const merchantSessionToken = getMerchantSessionTokenFromRequest(req);

    if (!merchantSessionToken) {
      return void res.status(401).json({
        ok: false,
        message:
          "Falta el merchant session token. Envía Authorization: Bearer <merchantSessionToken> o x-merchant-session-token."
      });
    }

    const merchantSession = readMerchantSessionToken(merchantSessionToken);

    if (!merchantSession?.accessToken) {
      return void res.status(401).json({
        ok: false,
        message:
          "La sesión merchant es inválida o expiró. Vuelve a iniciar OAuth desde /uber/auth/login."
      });
    }

    const stores = await getUberActivationService().getMerchantStores(
      merchantSession.accessToken
    );

    return void res.status(200).json({
      ok: true,
      message: "Stores autorizadas para el usuario obtenidas correctamente",
      data: {
        total: stores.length,
        stores
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener las stores autorizadas para el usuario",
      error,
      {
        endpoint: "GET /uber/stores",
        authSource:
          req.header("authorization") != null
            ? "Authorization"
            : req.header("x-merchant-session-token") != null
              ? "x-merchant-session-token"
              : req.query.sessionToken != null
                ? "query.sessionToken"
                : null
      }
    );
  }
}

export async function getMerchantStoreIntegrationDetails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const result = await getUberIntegrationService().getStoreIntegrationDetails(storeId);

    return void res.status(200).json({
      ok: true,
      message: "Detalle de integración obtenido correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener el detalle de integración de la store",
      error,
      {
        storeId: req.params.storeId ?? null
      }
    );
  }
}

export async function updateMerchantStoreIntegration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const body = req.body as Partial<UberUpdateStoreIntegrationRequest> | undefined;

    const payload: UberUpdateStoreIntegrationRequest = {
      is_order_manager:
        typeof body?.is_order_manager === "boolean"
          ? body.is_order_manager
          : undefined,
      integrator_store_id:
        body?.integrator_store_id ??
        process.env.UBER_DEFAULT_INTEGRATOR_STORE_ID ??
        undefined,
      integrator_brand_id:
        body?.integrator_brand_id ??
        process.env.UBER_DEFAULT_INTEGRATOR_BRAND_ID ??
        undefined,
      merchant_store_id:
        body?.merchant_store_id ??
        process.env.UBER_DEFAULT_MERCHANT_STORE_ID ??
        undefined
    };

    const result = await getUberIntegrationService().updateStoreIntegration(
      storeId,
      payload
    );

    return void res.status(200).json({
      ok: true,
      message: "Integración de la store actualizada correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible actualizar la integración de la store",
      error,
      {
        storeId: req.params.storeId ?? null,
        requestBody: {
          is_order_manager: req.body?.is_order_manager ?? null,
          integrator_store_id: req.body?.integrator_store_id ?? null,
          integrator_brand_id: req.body?.integrator_brand_id ?? null,
          merchant_store_id: req.body?.merchant_store_id ?? null
        }
      }
    );
  }
}

export async function removeMerchantStoreIntegration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);

    if (!storeId) {
      return;
    }

    const result = await getUberIntegrationService().removeStoreIntegration(storeId);

    return void res.status(200).json({
      ok: true,
      message: "Integración de la store removida correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible remover la integración de la store",
      error,
      {
        storeId: req.params.storeId ?? null
      }
    );
  }
}