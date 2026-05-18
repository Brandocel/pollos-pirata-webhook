import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import { getUberIntegrationActivationService } from "../services/uberIntegrationActivation.service";

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

export async function testIntegrationActivationScopes(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result =
      await getUberIntegrationActivationService().testActivationScopes();

    return void res.status(200).json({
      ok: true,
      message: "Scope de integration activation autorizado correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener token con scopes de integration activation",
      error,
      {
        scopes: ["eats.store", "eats.pos_provisioning"],
        note: "Uber indicó que Activate Integration requiere estos scopes."
      }
    );
  }
}

export async function activateIntegration(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result =
      await getUberIntegrationActivationService().activateIntegration();

    return void res.status(200).json({
      ok: true,
      message: "Activate Integration ejecutado correctamente",
      data: {
        uber_response: result
      }
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible ejecutar Activate Integration",
      error,
      {
        scopes: ["eats.store", "eats.pos_provisioning"]
      }
    );
  }
}