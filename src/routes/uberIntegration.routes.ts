import { Router } from "express";
import {
  getStoresToUser,
  getMerchantStoreIntegrationDetails,
  updateMerchantStoreIntegration,
  removeMerchantStoreIntegration
} from "../controllers/uberIntegration.controller";

const router = Router();

/**
 * Integration Config: Get stores to User
 *
 * Endpoint requerido por Uber para validar que el usuario/merchant
 * puede listar las stores autorizadas mediante OAuth authorization_code.
 *
 * Ruta final:
 * GET /uber/stores
 */
router.get("/stores", getStoresToUser);

router.get("/stores/:storeId/integration", getMerchantStoreIntegrationDetails);
router.put("/stores/:storeId/integration", updateMerchantStoreIntegration);
router.delete("/stores/:storeId/integration", removeMerchantStoreIntegration);

export default router;