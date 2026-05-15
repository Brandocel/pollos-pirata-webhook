import { Router, Request, Response } from "express";
import {
  clearUberWebhookHistoryHandler,
  getLastUberWebhookState,
  getUberWebhookEvidenceHandler,
  getUberWebhookHistory,
  handleUberWebhook
} from "../controllers/webhook.controller";

const router = Router();

router.get("/uber/webhook", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    message: "Webhook de Uber disponible"
  });
});

router.post("/uber/webhook", handleUberWebhook);

router.get("/uber/webhook/last-state", getLastUberWebhookState);
router.get("/uber/webhook/history", getUberWebhookHistory);
router.delete("/uber/webhook/history", clearUberWebhookHistoryHandler);
router.get("/uber/webhook/evidence", getUberWebhookEvidenceHandler);

export default router;