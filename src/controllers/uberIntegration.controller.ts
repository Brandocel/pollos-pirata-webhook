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
    if (token) return token;
  }

  const merchantSessionHeader = req.header("x-merchant-session-token");
  if (merchantSessionHeader?.trim()) return merchantSessionHeader.trim();

  const sessionQuery = req.query.sessionToken;
  if (typeof sessionQuery === "string" && sessionQuery.trim()) return sessionQuery.trim();

  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * GET /uber/stores
 * Integration Config: Get stores to User
 */
export async function getStoresToUser(req: Request, res: Response): Promise<void> {
  try {
    const merchantSessionToken = getMerchantSessionTokenFromRequest(req);

    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan("DEBUG GET STORES TO USER"));
    console.log(chalk.cyan("=============================================="));
    console.log(chalk.cyan(`merchantSessionToken presente: ${merchantSessionToken ? "Sí" : "No"}`));

    if (!merchantSessionToken) {
      return void res.status(401).json({
        ok: false,
        message: "Falta el merchant session token.",
        hint: "Primero completa el OAuth en /uber/auth/login con scope eats.pos_provisioning"
      });
    }

    const merchantSession = readMerchantSessionToken(merchantSessionToken);

    if (!merchantSession?.accessToken) {
      return void res.status(401).json({
        ok: false,
        message: "La sesión merchant es inválida o expiró. Vuelve a iniciar OAuth desde /uber/auth/login."
      });
    }

    const stores = await getUberActivationService().getMerchantStores(merchantSession.accessToken);

    console.log(chalk.green(`✓ Stores obtenidas correctamente: ${stores.length}`));

    return void res.status(200).json({
      ok: true,
      message: "Tiendas obtenidas correctamente",
      data: stores
    });
  } catch (error: unknown) {
    return sendDetailedError(res, "No fue posible obtener las stores autorizadas para el usuario", error, {
      endpoint: "GET /uber/stores"
    });
  }
}

export async function getMerchantStoreIntegrationDetails(req: Request, res: Response): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);
    if (!storeId) return;

    const result = await getUberIntegrationService().getStoreIntegrationDetails(storeId);

    return void res.status(200).json({
      ok: true,
      message: "Detalle de integración obtenido correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(res, "No fue posible obtener el detalle de integración de la store", error, {
      storeId: req.params.storeId ?? null
    });
  }
}

/**
 * PUT /uber/stores/:storeId/integration
 *
 * Actualiza la configuración de integración de una store.
 *
 * FIX: Ahora acepta webhooks_config en el body para poder actualizar
 * la versión de webhooks a 1.0.0, lo que activa los eventos
 * orders.failure y orders.scheduled.notification requeridos por Uber.
 *
 * Ejemplo de body para activar webhooks versión 1.0.0:
 * {
 *   "webhooks_config": {
 *     "webhooks_version": "1.0.0",
 *     "schedule_order_webhooks": { "is_enabled": true }
 *   }
 * }
 */
export async function updateMerchantStoreIntegration(req: Request, res: Response): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);
    if (!storeId) return;

    const body = req.body as Record<string, unknown> | undefined;

    const payload: UberUpdateStoreIntegrationRequest = {
      is_order_manager:
        typeof body?.is_order_manager === "boolean" ? body.is_order_manager : undefined,
      integrator_store_id:
        typeof body?.integrator_store_id === "string"
          ? body.integrator_store_id
          : process.env.UBER_DEFAULT_INTEGRATOR_STORE_ID ?? undefined,
      integrator_brand_id:
        typeof body?.integrator_brand_id === "string"
          ? body.integrator_brand_id
          : process.env.UBER_DEFAULT_INTEGRATOR_BRAND_ID ?? undefined,
      merchant_store_id:
        typeof body?.merchant_store_id === "string"
          ? body.merchant_store_id
          : process.env.UBER_DEFAULT_MERCHANT_STORE_ID ?? undefined
    };

    // FIX: Pasar webhooks_config directamente si viene en el body
    if (isPlainObject(body?.webhooks_config)) {
      (payload as Record<string, unknown>).webhooks_config = body.webhooks_config;
    }

    // Pasar integration_enabled si viene en el body
    if (typeof body?.integration_enabled === "boolean") {
      (payload as Record<string, unknown>).integration_enabled = body.integration_enabled;
    }

    // Pasar store_configuration_data si viene en el body
    if (body?.store_configuration_data != null) {
      (payload as Record<string, unknown>).store_configuration_data = body.store_configuration_data;
    }

    await getUberIntegrationService().updateStoreIntegration(storeId, payload);

    return void res.status(200).json({
      ok: true,
      message: "Integración de la store actualizada correctamente",
      data: { storeId, payload }
    });
  } catch (error: unknown) {
    return sendDetailedError(res, "No fue posible actualizar la integración de la store", error, {
      storeId: req.params.storeId ?? null,
      requestBody: req.body ?? null
    });
  }
}

export async function removeMerchantStoreIntegration(req: Request, res: Response): Promise<void> {
  try {
    const storeId = requireValidStoreId(req, res);
    if (!storeId) return;

    const result = await getUberIntegrationService().removeStoreIntegration(storeId);

    return void res.status(200).json({
      ok: true,
      message: "Integración de la store removida correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(res, "No fue posible remover la integración de la store", error, {
      storeId: req.params.storeId ?? null
    });
  }
}