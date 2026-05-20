import { Router } from "express";
import {
  acceptOrderManually,
  cancelOrderManually,
  denyOrderManually,
  getOrderDetails,
  getResolveFulfillmentIssueNotApplicableEvidence,
  listStoreOrders,
  markOrderAsReadyManually,
  resolveOrderFulfillmentIssueManually,
  runOrderValidationFlow,
  updateOrderManually
} from "../controllers/uberOrders.controller";

const router = Router();

router.get("/stores/:storeId/orders", listStoreOrders);

/**
 * Evidence endpoint para justificar a Uber que Resolve Fulfillment Issues
 * no aplica en esta validación actual.
 *
 * URL final si este router está montado en /uber:
 * GET /uber/orders/resolve-fulfillment-issue/not-applicable
 *
 * Importante:
 * Esta ruta va antes de /orders/:orderId para evitar conflictos.
 */
router.get(
  "/orders/resolve-fulfillment-issue/not-applicable",
  getResolveFulfillmentIssueNotApplicableEvidence
);

/**
 * Alias plural por si quieres usar una URL más parecida al nombre oficial.
 *
 * URL final:
 * GET /uber/orders/resolve-fulfillment-issues/not-applicable
 */
router.get(
  "/orders/resolve-fulfillment-issues/not-applicable",
  getResolveFulfillmentIssueNotApplicableEvidence
);

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