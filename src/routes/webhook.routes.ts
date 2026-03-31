import { Router } from "express";
import {
  getOrderDetailsManually,
  handleUberWebhook
} from "../controllers/webhook.controller";

const router = Router();

router.post("/uber/webhook", handleUberWebhook);
router.get("/uber/orders/:orderId", getOrderDetailsManually);

export default router;