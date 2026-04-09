import { Router } from "express";
import {
  startUberLogin,
  handleUberAuthCallback,
  getMerchantStores,
  activateMerchantStore,
  getMerchantSessionInfo
} from "../controllers/uberAuth.controller";

const router = Router();

router.get("/auth/login", startUberLogin);
router.get("/auth/callback", handleUberAuthCallback);
router.get("/session", getMerchantSessionInfo);
router.get("/stores", getMerchantStores);
router.post("/stores/:storeId/activate", activateMerchantStore);

export default router;