import { Router } from "express";
import {
  getMerchantStoreHolidayHours,
  updateMerchantStoreHolidayHours
} from "../controllers/uberStore.controller";

const router = Router();

router.get("/stores/:storeId/holiday-hours", getMerchantStoreHolidayHours);
router.post("/stores/:storeId/holiday-hours", updateMerchantStoreHolidayHours);

export default router;