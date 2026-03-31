"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
const router = (0, express_1.Router)();
router.post("/uber/webhook", webhook_controller_1.handleUberWebhook);
router.get("/uber/orders/:orderId", webhook_controller_1.getOrderDetailsManually);
exports.default = router;
