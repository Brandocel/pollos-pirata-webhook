import { Router } from "express";
import {
  acceptOrderManually,
  cancelOrderManually,
  denyOrderManually,
  getOrderDetails,
  listStoreOrders,
  markOrderAsReadyManually,
  resolveOrderFulfillmentIssueManually,
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

/**
 * Endpoint técnico existente.
 * Lo dejamos porque ya lo tenías registrado.
 */
router.patch("/orders/:orderId/cart", updateOrderManually);

/**
 * Alias claro para validación de Uber.
 * Internamente usa el flujo de fulfillment issues / patch cart.
 */
router.post(
  "/orders/:orderId/resolve-fulfillment-issues",
  resolveOrderFulfillmentIssueManually
);

router.post("/orders/:orderId/validate-flow", runOrderValidationFlow);

export default router;