import { Router } from "express";
import {
  createStorePromotion,
  getPromotionDetails,
  listStorePromotions,
  revokePromotion
} from "../controllers/uberPromotions.controller";
import {
  testPromotionReadScope,
  testPromotionWriteScope
} from "../controllers/uberPromotionsScope.controller";

const router = Router();

router.get("/promotion/scopes/write/test", testPromotionWriteScope);
router.get("/promotion/scopes/read/test", testPromotionReadScope);

router.post("/stores/:storeId/promotion", createStorePromotion);
router.get("/stores/:storeId/promotions", listStorePromotions);
router.get("/promotions/:promotionId", getPromotionDetails);
router.post("/promotions/:promotionId/revoke", revokePromotion);

export default router;