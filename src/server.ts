import "dotenv/config";
import express, { Application, NextFunction, Request, Response } from "express";
import chalk from "chalk";
import cors, { CorsOptions } from "cors";
import webhookRoutes from "./routes/webhook.routes";
import uberAuthRoutes from "./routes/uberAuth.routes";
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

app.use(
  "/webhooks",
  express.raw({
    type: "*/*",
    limit: "2mb"
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

setupSwagger(app as express.Express);

app.use(publicRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/uber", uberAuthRoutes);

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
  console.log(chalk.white(`Webhook: ${publicUrl}/webhooks/uber/webhook`));
  console.log(chalk.white(`Allowed origins: ${allowedOrigins.join(", ") || "Todos"}`));
  console.log(chalk.green("Servidor iniciado correctamente"));
});