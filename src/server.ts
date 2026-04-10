import "dotenv/config";
import express, { Application, NextFunction, Request, Response } from "express";
import chalk from "chalk";
import cors, { CorsOptions } from "cors";
import webhookRoutes from "./routes/webhook.routes";
import uberAuthRoutes from "./routes/uberAuth.routes";
import uberIntegrationRoutes from "./routes/uberIntegration.routes";
import uberStoreRoutes from "./routes/uberStore.routes";
import uberMenuRoutes from "./routes/uberMenu.routes";
import uberOrdersRoutes from "./routes/uberOrders.routes";
import publicRoutes from "./routes/public.routes";
import { setupSwagger } from "./docs/swagger";

const app: Application = express();
const port = Number(process.env.PORT || 3000);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
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

const publicUrl =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.APP_URL ||
  `http://localhost:${port}`;

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "pollos-pirata-uber-eats",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    url: publicUrl
  });
});

// ====================== RAW BODY SOLO PARA WEBHOOKS ======================
app.use(
  "/webhooks",
  express.raw({
    type: "*/*",
    limit: "2mb"
  })
);

// ====================== LOG DE DIAGNÓSTICO PARA WEBHOOKS ======================
app.use("/webhooks", (req: Request, _res: Response, next: NextFunction) => {
  console.log(chalk.yellow("========================================================"));
  console.log(chalk.yellow(" REQUEST ENTRANTE A /webhooks"));
  console.log(chalk.yellow(` Método: ${req.method}`));
  console.log(chalk.yellow(` URL: ${req.originalUrl}`));
  console.log(chalk.yellow(` Content-Type: ${req.header("content-type") ?? "N/A"}`));
  console.log(
    chalk.yellow(` X-Uber-Signature: ${req.header("X-Uber-Signature") ? "Sí" : "No"}`)
  );

  if (Buffer.isBuffer(req.body)) {
    console.log(chalk.yellow(` Raw body length: ${req.body.length}`));
  } else {
    console.log(chalk.yellow(" Raw body length: body no es Buffer"));
  }

  console.log(chalk.yellow("========================================================"));
  next();
});

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

setupSwagger(app as express.Express);

app.use(publicRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/uber", uberAuthRoutes);
app.use("/uber", uberIntegrationRoutes);
app.use("/uber", uberStoreRoutes);
app.use("/uber", uberMenuRoutes);
app.use("/uber", uberOrdersRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada"
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(chalk.red("Error no controlado en Express"));

  if (err instanceof Error) {
    console.error(chalk.red(err.message));

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
  console.log(chalk.green("========================================================"));
  console.log(chalk.green(" Pollos Pirata - Uber Eats Integration Server"));
  console.log(chalk.green("========================================================"));
  console.log(chalk.white(`Puerto interno: ${port}`));
  console.log(chalk.white(`URL pública/base: ${publicUrl}`));
  console.log(chalk.white(`Health: ${publicUrl}/health`));
  console.log(chalk.white(`Swagger: ${publicUrl}/docs`));
  console.log(chalk.white(`Privacy: ${publicUrl}/privacy`));
  console.log(chalk.white(`OAuth Login: ${publicUrl}/uber/auth/login`));
  console.log(chalk.white(`OAuth Callback: ${publicUrl}/uber/auth/callback`));
  console.log(chalk.white(`Session: ${publicUrl}/uber/session`));
  console.log(chalk.white(`Stores: ${publicUrl}/uber/stores`));
  console.log(chalk.white(`Store Integration: ${publicUrl}/uber/stores/{storeId}/integration`));
  console.log(chalk.white(`Store Holiday Hours: ${publicUrl}/uber/stores/{storeId}/holiday-hours`));
  console.log(chalk.white(`Get Menu: ${publicUrl}/uber/stores/{storeId}/menu`));
  console.log(chalk.white(`Upload Menu: ${publicUrl}/uber/stores/{storeId}/menu`));
  console.log(chalk.white(`Update Item: ${publicUrl}/uber/stores/{storeId}/menu/items/{itemId}`));
  console.log(chalk.white(`Get Order Details: ${publicUrl}/uber/orders/{orderId}`));
  console.log(chalk.white(`Webhook: ${publicUrl}/webhooks/uber/webhook`));
  console.log(chalk.white(`Allowed origins: ${allowedOrigins.join(", ") || "Todos"}`));
  console.log(chalk.green("Servidor iniciado correctamente"));
});