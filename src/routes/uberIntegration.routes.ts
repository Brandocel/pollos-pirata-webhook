import { Router } from "express";
import {
  getMerchantStoreIntegrationDetails,
  updateMerchantStoreIntegration,
  removeMerchantStoreIntegration
} from "../controllers/uberIntegration.controller";

const router = Router();

router.get("/stores/:storeId/integration", getMerchantStoreIntegrationDetails);
router.put("/stores/:storeId/integration", updateMerchantStoreIntegration);
router.delete("/stores/:storeId/integration", removeMerchantStoreIntegration);

export default router;