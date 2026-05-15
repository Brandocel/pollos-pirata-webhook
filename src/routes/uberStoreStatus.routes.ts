import { Router } from "express";
import {
  getStoreStatus,
  testRestaurantDeliveryStatusScope,
  testStoreStatusReadScope,
  testStoreStatusWriteScope,
  updateStoreStatus
} from "../controllers/uberStoreStatus.controller";

const router = Router();

router.get("/store-status/scopes/read/test", testStoreStatusReadScope);
router.get("/store-status/scopes/write/test", testStoreStatusWriteScope);
router.get(
  "/store-status/scopes/restaurant-delivery/test",
  testRestaurantDeliveryStatusScope
);

router.get("/stores/:storeId/status", getStoreStatus);
router.put("/stores/:storeId/status", updateStoreStatus);

export default router;