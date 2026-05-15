"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const chalk_1 = __importDefault(require("chalk"));
const cors_1 = __importDefault(require("cors"));
const webhook_routes_1 = __importDefault(require("./routes/webhook.routes"));
const uberAuth_routes_1 = __importDefault(require("./routes/uberAuth.routes"));
const uberIntegration_routes_1 = __importDefault(require("./routes/uberIntegration.routes"));
const uberStore_routes_1 = __importDefault(require("./routes/uberStore.routes"));
const uberMenu_routes_1 = __importDefault(require("./routes/uberMenu.routes"));
const uberOrders_routes_1 = __importDefault(require("./routes/uberOrders.routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const swagger_1 = require("./docs/swagger");
const app = (0, express_1.default)();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS no permitido para el origen: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Uber-Signature",
        "Accept",
        "Origin"
    ],
    credentials: true
};
const publicUrl = process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    `http://localhost:${port}`;
app.set("trust proxy", 1);
app.use((0, cors_1.default)(corsOptions));
app.options("*", (0, cors_1.default)(corsOptions));
app.get("/health", (_req, res) => {
    res.status(200).json({
        ok: true,
        service: "pollos-pirata-uber-eats",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
        url: publicUrl
    });
});
// ====================== RAW BODY SOLO PARA WEBHOOKS ======================
app.use("/webhooks", express_1.default.raw({
    type: "*/*",
    limit: "2mb"
}));
// ====================== LOG DE DIAGNÓSTICO PARA WEBHOOKS ======================
app.use("/webhooks", (req, _res, next) => {
    console.log(chalk_1.default.yellow("========================================================"));
    console.log(chalk_1.default.yellow(" REQUEST ENTRANTE A /webhooks"));
    console.log(chalk_1.default.yellow(` Método: ${req.method}`));
    console.log(chalk_1.default.yellow(` URL: ${req.originalUrl}`));
    console.log(chalk_1.default.yellow(` Content-Type: ${req.header("content-type") ?? "N/A"}`));
    console.log(chalk_1.default.yellow(` X-Uber-Signature: ${req.header("X-Uber-Signature") ? "Sí" : "No"}`));
    if (Buffer.isBuffer(req.body)) {
        console.log(chalk_1.default.yellow(` Raw body length: ${req.body.length}`));
    }
    else {
        console.log(chalk_1.default.yellow(" Raw body length: body no es Buffer"));
    }
    console.log(chalk_1.default.yellow("========================================================"));
    next();
});
app.use(express_1.default.json({ limit: "8mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "8mb" }));
(0, swagger_1.setupSwagger)(app);
app.use(public_routes_1.default);
app.use("/webhooks", webhook_routes_1.default);
app.use("/uber", uberAuth_routes_1.default);
app.use("/uber", uberIntegration_routes_1.default);
app.use("/uber", uberStore_routes_1.default);
app.use("/uber", uberMenu_routes_1.default);
app.use("/uber", uberOrders_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({
        ok: false,
        message: "Ruta no encontrada"
    });
});
app.use((err, _req, res, _next) => {
    console.error(chalk_1.default.red("Error no controlado en Express"));
    if (err instanceof Error) {
        console.error(chalk_1.default.red(err.message));
        if (err.message.includes("CORS")) {
            return res.status(403).json({
                ok: false,
                message: err.message
            });
        }
    }
    return res.status(500).json({
        ok: false,
        message: "Error interno del servidor"
    });
});
app.listen(port, "0.0.0.0", () => {
    console.log(chalk_1.default.green("========================================================"));
    console.log(chalk_1.default.green(" Pollos Pirata - Uber Eats Integration Server"));
    console.log(chalk_1.default.green("========================================================"));
    console.log(chalk_1.default.white(`Puerto interno: ${port}`));
    console.log(chalk_1.default.white(`URL pública/base: ${publicUrl}`));
    console.log(chalk_1.default.white(`Health: ${publicUrl}/health`));
    console.log(chalk_1.default.white(`Swagger: ${publicUrl}/docs`));
    console.log(chalk_1.default.white(`Privacy: ${publicUrl}/privacy`));
    console.log(chalk_1.default.white(`OAuth Login: ${publicUrl}/uber/auth/login`));
    console.log(chalk_1.default.white(`OAuth Callback: ${publicUrl}/uber/auth/callback`));
    console.log(chalk_1.default.white(`Session: ${publicUrl}/uber/session`));
    console.log(chalk_1.default.white(`Stores: ${publicUrl}/uber/stores`));
    console.log(chalk_1.default.white(`Store Integration: ${publicUrl}/uber/stores/{storeId}/integration`));
    console.log(chalk_1.default.white(`Store Holiday Hours: ${publicUrl}/uber/stores/{storeId}/holiday-hours`));
    console.log(chalk_1.default.white(`Get Menu: ${publicUrl}/uber/stores/{storeId}/menu`));
    console.log(chalk_1.default.white(`Upload Menu: ${publicUrl}/uber/stores/{storeId}/menu`));
    console.log(chalk_1.default.white(`Update Item: ${publicUrl}/uber/stores/{storeId}/menu/items/{itemId}`));
    console.log(chalk_1.default.white(`Get Order Details: ${publicUrl}/uber/orders/{orderId}`));
    console.log(chalk_1.default.white(`Webhook: ${publicUrl}/webhooks/uber/webhook`));
    console.log(chalk_1.default.white(`Allowed origins: ${allowedOrigins.join(", ") || "Todos"}`));
    console.log(chalk_1.default.green("Servidor iniciado correctamente"));
    console.log(chalk_1.default.white(`Accept Order: ${publicUrl}/uber/orders/{orderId}/accept`));
    console.log(chalk_1.default.white(`Deny Order: ${publicUrl}/uber/orders/{orderId}/deny`));
    console.log(chalk_1.default.white(`Cancel Order: ${publicUrl}/uber/orders/{orderId}/cancel`));
    console.log(chalk_1.default.white(`Update Order Cart: ${publicUrl}/uber/orders/{orderId}/cart`));
    console.log(chalk_1.default.white(`Validate Flow: ${publicUrl}/uber/orders/{orderId}/validate-flow`));
    console.log(chalk_1.default.white(`Webhook Last State: ${publicUrl}/webhooks/uber/webhook/last-state`));
    console.log(chalk_1.default.white(`Webhook History: ${publicUrl}/webhooks/uber/webhook/history`));
    console.log(chalk_1.default.white(`Webhook Evidence: ${publicUrl}/webhooks/uber/webhook/evidence`));
});
