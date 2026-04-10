import { Router } from "express";
import { handleUberWebhook } from "../controllers/webhook.controller";

const router = Router();

router.get("/uber/webhook", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "Webhook endpoint activo. Usa POST para enviar eventos."
  });
});

router.post("/uber/webhook", handleUberWebhook);

export default router;