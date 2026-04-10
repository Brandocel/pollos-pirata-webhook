import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerConfig, getServerUrl } from "./config";
import { swaggerTags } from "./tags";
import { swaggerComponents } from "./components";
import { swaggerPaths } from "./paths";

const serverUrl = getServerUrl();
const isProduction = process.env.NODE_ENV === "production";

const swaggerDocument = {
  ...swaggerConfig,
  servers: [
    {
      url: serverUrl,
      description: isProduction ? "Servidor Render" : "Servidor local"
    }
  ],
  tags: swaggerTags,
  paths: swaggerPaths,
  components: swaggerComponents
};

export function setupSwagger(app: Express): void {
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true
      }
    })
  );
}