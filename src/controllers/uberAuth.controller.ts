import { Request, Response } from "express";
import chalk from "chalk";
import crypto from "crypto";
import { getUberActivationService } from "../services/uberActivation.service";
import { UberActivateStoreRequest } from "../types/uber";

interface MerchantSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

const oauthStateStore = new Map<string, number>();
let merchantSession: MerchantSession | null = null;

function createState(): string {
  return crypto.randomBytes(24).toString("hex");
}

function isMerchantSessionValid(): boolean {
  if (!merchantSession) return false;
  return Date.now() < merchantSession.expiresAt;
}

export async function startUberLogin(req: Request, res: Response): Promise<void> {
  try {
    const activationService = getUberActivationService();
    const state = createState();

    oauthStateStore.set(state, Date.now());

    const url = activationService.buildAuthorizationUrl(state);

    res.redirect(url);
  } catch (error: unknown) {
    console.error(chalk.red("Error iniciando OAuth con Uber"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }

    res.status(500).json({
      ok: false,
      message: "No fue posible iniciar sesión con Uber"
    });
  }
}

export async function handleUberAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      res.status(400).json({
        ok: false,
        message: "Uber devolvió un error en OAuth",
        error,
        error_description: error_description ?? null
      });
      return;
    }

    if (!code || typeof code !== "string") {
      res.status(400).json({
        ok: false,
        message: "No se recibió el code de autorización"
      });
      return;
    }

    if (!state || typeof state !== "string") {
      res.status(400).json({
        ok: false,
        message: "No se recibió el state"
      });
      return;
    }

    const storedAt = oauthStateStore.get(state);

    if (!storedAt) {
      res.status(400).json({
        ok: false,
        message: "State inválido o expirado"
      });
      return;
    }

    oauthStateStore.delete(state);

    const activationService = getUberActivationService();
    const tokenResponse = await activationService.exchangeCodeForToken(code);
    const stores = await activationService.getMerchantStores(tokenResponse.access_token);

    merchantSession = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + Math.max(tokenResponse.expires_in - 60, 60) * 1000,
      scope: tokenResponse.scope
    };

    console.log(chalk.green("✓ Merchant autenticado correctamente con Uber"));

    res.status(200).json({
      ok: true,
      message: "Merchant autenticado correctamente",
      data: {
        scope: tokenResponse.scope ?? null,
        expires_in: tokenResponse.expires_in,
        stores
      }
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error en callback OAuth de Uber"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }

    res.status(500).json({
      ok: false,
      message: "No fue posible completar la autenticación con Uber"
    });
  }
}

export async function getMerchantStores(req: Request, res: Response): Promise<void> {
  try {
    if (!isMerchantSessionValid() || !merchantSession) {
      res.status(401).json({
        ok: false,
        message: "No hay una sesión de merchant activa. Primero entra a /uber/auth/login"
      });
      return;
    }

    const activationService = getUberActivationService();
    const stores = await activationService.getMerchantStores(merchantSession.accessToken);

    res.status(200).json({
      ok: true,
      message: "Tiendas obtenidas correctamente",
      data: stores
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error obteniendo stores del merchant"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }

    res.status(500).json({
      ok: false,
      message: "No fue posible obtener las tiendas del merchant"
    });
  }
}

export async function activateMerchantStore(req: Request, res: Response): Promise<void> {
  try {
    if (!isMerchantSessionValid() || !merchantSession) {
      res.status(401).json({
        ok: false,
        message: "No hay una sesión de merchant activa. Primero entra a /uber/auth/login"
      });
      return;
    }

    const { storeId } = req.params;

    if (!storeId || Array.isArray(storeId)) {
      res.status(400).json({
        ok: false,
        message: "Falta el storeId o el formato es inválido"
      });
      return;
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
      merchantSession.accessToken,
      storeId,
      payload
    );

    res.status(200).json({
      ok: true,
      message: "Store activada correctamente",
      data: result
    });
  } catch (error: unknown) {
    console.error(chalk.red("Error activando store del merchant"));

    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }

    res.status(500).json({
      ok: false,
      message: "No fue posible activar la store"
    });
  }
}

export async function getMerchantSessionInfo(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    ok: true,
    data: {
      authenticated: isMerchantSessionValid(),
      expiresAt: merchantSession?.expiresAt ?? null,
      scope: merchantSession?.scope ?? null
    }
  });
}