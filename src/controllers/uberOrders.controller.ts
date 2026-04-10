import { Request, Response } from "express";
import chalk from "chalk";
import { UberApiRequestError } from "../services/uberActivation.service";
import { getUberOrdersService } from "../services/uberOrders.service";

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

function requireValidOrderId(req: Request, res: Response): string | null {
  const { orderId } = req.params;

  if (!orderId || Array.isArray(orderId)) {
    res.status(400).json({
      ok: false,
      message: "Falta el orderId o el formato es inválido"
    });
    return null;
  }

  const normalized = orderId.trim();

  if (!normalized) {
    res.status(400).json({
      ok: false,
      message: "El orderId es requerido"
    });
    return null;
  }

  return normalized;
}

export async function getMerchantOrderDetails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const orderId = requireValidOrderId(req, res);

    if (!orderId) {
      return;
    }

    const result = await getUberOrdersService().getOrderDetails(orderId);

    return void res.status(200).json({
      ok: true,
      message: "Detalle de orden obtenido correctamente",
      data: result
    });
  } catch (error: unknown) {
    return sendDetailedError(
      res,
      "No fue posible obtener el detalle de la orden",
      error,
      {
        orderId: req.params.orderId ?? null
      }
    );
  }
}