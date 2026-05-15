import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import { getUberAppTokenService } from "../services/uberAppToken.service";

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

export async function testPromotionsWriteScope(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const scope = "eats.store.promotions.write";

    await getUberAppTokenService().getAccessToken([scope]);

    return void res.status(200).json({
      ok: true,
      message: "Scope de promociones write autorizado correctamente",
      data: {
        scope,
        token_obtained: true
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener token con scope de promociones write",
      error,
      {
        scope: "eats.store.promotions.write"
      }
    );
  }
}

export async function testPromotionsReadScope(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const scope = "eats.store.promotions.read";

    await getUberAppTokenService().getAccessToken([scope]);

    return void res.status(200).json({
      ok: true,
      message: "Scope de promociones read autorizado correctamente",
      data: {
        scope,
        token_obtained: true
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener token con scope de promociones read",
      error,
      {
        scope: "eats.store.promotions.read"
      }
    );
  }
}