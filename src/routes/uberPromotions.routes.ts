import { Router } from "express";
import {
  createStorePromotion,
  getStorePromotionDetails,
  listStorePromotions,
  revokeStorePromotion
} from "../controllers/uberPromotions.controller";

const router = Router();

router.post("/stores/:storeId/promotions", createStorePromotion);
router.get("/stores/:storeId/promotions", listStorePromotions);
router.get("/stores/:storeId/promotions/:promotionId", getStorePromotionDetails);
router.post("/stores/:storeId/promotions/:promotionId/revoke", revokeStorePromotion);

export default router;