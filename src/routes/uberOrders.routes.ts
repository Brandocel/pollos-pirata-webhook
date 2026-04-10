import { Router } from "express";
import {
  getOrderDetails,
  listStoreOrders
} from "../controllers/uberOrders.controller";

const router = Router();

router.get("/orders/:orderId", getOrderDetails);
router.get("/stores/:storeId/orders", listStoreOrders);

export default router;