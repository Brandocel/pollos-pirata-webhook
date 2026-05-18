import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import {
  getUberIntegrationActivationService,
  UberIntegrationActivationPayload,
} from "../services/uberIntegrationActivation.service";

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
        context: context ?? null,
      },
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
        context: context ?? null,
      },
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
      context: context ?? null,
    },
  });
}

function getMerchantSessionTokenFromRequest(req: Request): string | null {
  const headerValue = req.headers["x-merchant-session-token"];

  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  const queryValue = req.query.merchant_session_token;

  if (typeof queryValue === "string" && queryValue.trim().length > 0) {
    return queryValue.trim();
  }

  return null;
}

function getStoreIdFromRequest(req: Request): string | null {
  const paramValue = req.params.storeId;

  if (typeof paramValue === "string" && paramValue.trim().length > 0) {
    return paramValue.trim();
  }

  const queryValue = req.query.store_id;

  if (typeof queryValue === "string" && queryValue.trim().length > 0) {
    return queryValue.trim();
  }

  return null;
}

export async function testIntegrationActivationMerchantSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const merchantSessionToken = getMerchantSessionTokenFromRequest(req);

    if (!merchantSessionToken) {
      return void res.status(400).json({
        ok: false,
        message:
          "Falta x-merchant-session-token en headers o merchant_session_token en query params",
      });
    }

    const result =
      await getUberIntegrationActivationService().testMerchantSessionScopes(
        merchantSessionToken
      );

    return void res.status(200).json({
      ok: true,
      message: "Merchant session token válido para integration activation",
      data: result,
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible validar merchant session token para integration activation",
      error,
      {
        required_scope: "eats.pos_provisioning",
        auth_type: "authorization_code",
      }
    );
  }
}

export async function activateIntegration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const merchantSessionToken = getMerchantSessionTokenFromRequest(req);

    if (!merchantSessionToken) {
      return void res.status(400).json({
        ok: false,
        message:
          "Falta x-merchant-session-token en headers o merchant_session_token en query params",
      });
    }

    const storeId = getStoreIdFromRequest(req);

    if (!storeId) {
      return void res.status(400).json({
        ok: false,
        message:
          "Falta storeId en path params o store_id en query params. Ejemplo: /uber/integration-activation/stores/:storeId/activate",
      });
    }

    const payload =
      req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
        ? (req.body as UberIntegrationActivationPayload)
        : undefined;

    const result =
      await getUberIntegrationActivationService().activateIntegration(
        merchantSessionToken,
        storeId,
        payload
      );

    return void res.status(200).json({
      ok: true,
      message: "Activate Integration ejecutado correctamente",
      data: {
        store_id: storeId,
        submitted_payload: payload ?? null,
        uber_response: result,
      },
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible ejecutar Activate Integration",
      error,
      {
        required_scope: "eats.pos_provisioning",
        auth_type: "authorization_code",
      }
    );
  }
}