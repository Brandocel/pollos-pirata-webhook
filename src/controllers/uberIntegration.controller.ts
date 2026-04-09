import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import { getUberIntegrationService } from "../services/uberIntegration.service";
import { UberUpdateStoreIntegrationRequest } from "../types/uber";

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