import { Router } from "express";
import {
  acceptOrderManually,
  cancelOrderManually,
  denyOrderManually,
  getOrderDetails,
  listStoreOrders,
  markOrderAsReadyManually,
  runOrderValidationFlow,
  updateOrderManually
} from "../controllers/uberOrders.controller";

const router = Router();

router.get("/stores/:storeId/orders", listStoreOrders);
router.get("/orders/:orderId", getOrderDetails);

router.post("/orders/:orderId/accept", acceptOrderManually);
router.post("/orders/:orderId/deny", denyOrderManually);
router.post("/orders/:orderId/cancel", cancelOrderManually);
router.post("/orders/:orderId/ready", markOrderAsReadyManually);

router.patch("/orders/:orderId/cart", updateOrderManually);
router.post("/orders/:orderId/validate-flow", runOrderValidationFlow);

export default router;