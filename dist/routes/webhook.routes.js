"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
const router = (0, express_1.Router)();
router.get("/uber/webhook", (_req, res) => {
    res.status(200).json({
        ok: true,
        message: "Webhook de Uber disponible"
    });
});
router.post("/uber/webhook", webhook_controller_1.handleUberWebhook);
router.get("/uber/webhook/last-state", webhook_controller_1.getLastUberWebhookState);
router.get("/uber/webhook/history", webhook_controller_1.getUberWebhookHistory);
router.delete("/uber/webhook/history", webhook_controller_1.clearUberWebhookHistoryHandler);
router.get("/uber/webhook/evidence", webhook_controller_1.getUberWebhookEvidenceHandler);
exports.default = router;
