import { Router } from "express";
import {
  startUberLogin,
  handleUberAuthCallback,
  getMerchantStores,
  activateMerchantStore,
  getMerchantStoreIntegrationDetails,
  updateMerchantStoreIntegration,
  removeMerchantStoreIntegration,
  getMerchantSessionInfo
} from "../controllers/uberAuth.controller";

const router = Router();

router.get("/auth/login", startUberLogin);
router.get("/auth/callback", handleUberAuthCallback);
router.get("/session", getMerchantSessionInfo);

router.get("/stores", getMerchantStores);

router.post("/stores/:storeId/activate", activateMerchantStore);
router.get("/stores/:storeId/integration", getMerchantStoreIntegrationDetails);
router.put("/stores/:storeId/integration", updateMerchantStoreIntegration);
router.delete("/stores/:storeId/integration", removeMerchantStoreIntegration);

export default router;