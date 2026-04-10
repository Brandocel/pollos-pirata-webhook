import { Router } from "express";
import { getMerchantOrderDetails } from "../controllers/uberOrders.controller";

const router = Router();

/**
 * @route GET /uber/orders/:orderId
 * @desc Obtener el detalle de una orden de Uber Eats
 */
router.get("/orders/:orderId", getMerchantOrderDetails);

export default router;