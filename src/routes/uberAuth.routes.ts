import { Router } from "express";
import {
  activateMerchantStore,
  getMerchantSessionInfo,
  getMerchantStores,
  handleUberAuthCallback,
  startUberLogin
} from "../controllers/uberAuth.controller";

const router = Router();

router.get("/auth/login", startUberLogin);
router.get("/auth/callback", handleUberAuthCallback);
router.get("/session", getMerchantSessionInfo);
router.get("/stores", getMerchantStores);
router.post("/stores/:storeId/activate", activateMerchantStore);

export default router;