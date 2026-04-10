import { Router } from "express";
import {
  getMerchantStoreMenu,
  uploadMerchantStoreMenu,
  updateMerchantStoreMenuItem
} from "../controllers/uberMenu.controller";

const router = Router();

router.get("/stores/:storeId/menu", getMerchantStoreMenu);
router.put("/stores/:storeId/menu", uploadMerchantStoreMenu);
router.post("/stores/:storeId/menu/items/:itemId", updateMerchantStoreMenuItem);

export default router;