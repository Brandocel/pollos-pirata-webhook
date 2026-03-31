import "dotenv/config";
import express, { Application, NextFunction, Request, Response } from "express";
import chalk from "chalk";
import webhookRoutes from "./routes/webhook.routes";
import uberAuthRoutes from "./routes/uberAuth.routes";
import { setupSwagger } from "./docs/swagger";

const app: Application = express();
const port = Number(process.env.PORT || 3000);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "pollos-pirata-uber-eats",
    timestamp: new Date().toISOString()
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

app.use("/webhooks", webhookRoutes);
app.use("/uber", uberAuthRoutes);
app.use("/uber", webhookRoutes);

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
  } else {
    console.error(chalk.red("Error desconocido"));
  }

  res.status(500).json({
    ok: false,
    message: "Error interno del servidor"
  });
});

app.listen(port, () => {
  console.log(chalk.green("========================================================"));
  console.log(chalk.green(" Pollos Pirata - Uber Eats Integration Server"));
  console.log(chalk.green("========================================================"));
  console.log(chalk.white(`Puerto: http://localhost:${port}`));
  console.log(chalk.white(`Health: http://localhost:${port}/health`));
  console.log(chalk.white(`Swagger: http://localhost:${port}/docs`));
  console.log(chalk.white(`OAuth Login: http://localhost:${port}/uber/auth/login`));
  console.log(chalk.white(`OAuth Callback: http://localhost:${port}/uber/auth/callback`));
  console.log(chalk.white(`Session: http://localhost:${port}/uber/session`));
  console.log(chalk.white(`Stores: http://localhost:${port}/uber/stores`));
  console.log(chalk.white(`Webhook: http://localhost:${port}/webhooks/uber/webhook`));
  console.log(chalk.green("Servidor iniciado correctamente"));
});