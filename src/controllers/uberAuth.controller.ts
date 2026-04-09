import { Request, Response } from "express";
import chalk from "chalk";
import { getUberActivationService } from "../services/uberActivation.service";
import { UberActivateStoreRequest } from "../types/uber";
import { createOAuthState, verifyOAuthState } from "../utils/oauthState";
import {
  createMerchantSessionToken,
  readMerchantSessionToken,
  MerchantSessionPayload
} from "../utils/merchantSessionToken";

function getBearerToken(req: Request): string | null {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

function getSessionFromRequest(req: Request): MerchantSessionPayload | null {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  return readMerchantSessionToken(token);
}

export async function startUberLogin(req: Request, res: Response): Promise<void> {
  try {
    const activationService = getUberActivationService();
    const state = createOAuthState();
    const url = activationService.buildAuthorizationUrl(state);

    return res.redirect(url);
  } catch (error: unknown) {
    console.error(chalk.red("Error iniciando OAuth con Uber"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red("Error desconocido"));
    }

    return void res.status(500).json({
      ok: false,
      message: "No fue posible iniciar sesión con Uber"
    });
  }
}

export async function handleUberAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return void res.status(400).json({
        ok: false,
        message: "Uber devolvió un error en OAuth",
        error,
        error_description: error_description ?? null
      });
    }

    if (!code || typeof code !== "string") {
      return void res.status(400).json({
        ok: false,
        message: "No se recibió el code de autorización"
      });
    }

    if (!state || typeof state !== "string") {
      return void res.status(400).json({
        ok: false,
        message: "No se recibió el state"
      });
    }

    const statePayload = verifyOAuthState(state);

    if (!statePayload) {
      return void res.status(400).json({
        ok: false,
        message: "State inválido o expirado"
      });
    }

    const activationService = getUberActivationService();
    const tokenResponse = await activationService.exchangeCodeForToken(code);
    const stores = await activationService.getMerchantStores(tokenResponse.access_token);

    const sessionToken = createMerchantSessionToken({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + Math.max(tokenResponse.expires_in - 60, 60) * 1000,
      scope: tokenResponse.scope
    });

    console.log(chalk.green("✓ Merchant autenticado correctamente con Uber"));

    return void res.status(200).json({
      ok: true,
      message: "Merchant autenticado correctamente",
      data: {
        session_token: sessionToken,
        scope: tokenResponse.scope ?? null,
        expires_in: tokenResponse.expires_in,
        stores
      }
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error en callback OAuth de Uber"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red("Error desconocido"));
    }

    return void res.status(500).json({
      ok: false,
      message: "No fue posible completar la autenticación con Uber"
    });
  }
}

export async function getMerchantStores(req: Request, res: Response): Promise<void> {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return void res.status(401).json({
        ok: false,
        message: "Sesión merchant inválida o expirada"
      });
    }

    const activationService = getUberActivationService();
    const stores = await activationService.getMerchantStores(session.accessToken);

    return void res.status(200).json({
      ok: true,
      message: "Tiendas obtenidas correctamente",
      data: stores
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error obteniendo stores del merchant"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red("Error desconocido"));
    }

    return void res.status(500).json({
      ok: false,
      message: "No fue posible obtener las tiendas del merchant"
    });
  }
}

export async function activateMerchantStore(req: Request, res: Response): Promise<void> {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return void res.status(401).json({
        ok: false,
        message: "Sesión merchant inválida o expirada"
      });
    }

    const { storeId } = req.params;

    if (!storeId || Array.isArray(storeId)) {
      return void res.status(400).json({
        ok: false,
        message: "Falta el storeId o el formato es inválido"
      });
    }

    const body = req.body as Partial<UberActivateStoreRequest> | undefined;

    const payload: UberActivateStoreRequest = {
      is_order_manager:
        typeof body?.is_order_manager === "boolean"
          ? body.is_order_manager
          : process.env.UBER_IS_ORDER_MANAGER === "true",
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

    const result = await getUberActivationService().activateStore(
      session.accessToken,
      storeId,
      payload
    );

    return void res.status(200).json({
      ok: true,
      message: "Store activada correctamente",
      data: result
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error activando store del merchant"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red("Error desconocido"));
    }

    return void res.status(500).json({
      ok: false,
      message: "No fue posible activar la store"
    });
  }
}

export async function getMerchantSessionInfo(req: Request, res: Response): Promise<void> {
  try {
    const session = getSessionFromRequest(req);

    return void res.status(200).json({
      ok: true,
      data: {
        authenticated: !!session,
        expiresAt: session?.expiresAt ?? null,
        scope: session?.scope ?? null
      }
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error consultando sesión del merchant"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    } else {
      console.error(chalk.red("Error desconocido"));
    }

    return void res.status(500).json({
      ok: false,
      message: "No fue posible obtener la sesión del merchant"
    });
  }
}