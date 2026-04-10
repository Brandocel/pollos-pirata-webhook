export function getServerUrl(): string {
    const port = Number(process.env.PORT || 3000);
  
    return (
      process.env.RENDER_EXTERNAL_URL ||
      process.env.APP_URL ||
      `http://localhost:${port}`
    );
  }
  
  export const swaggerConfig = {
    openapi: "3.0.3",
    info: {
      title: "Pollos Pirata - Uber Eats Integration API",
      version: "1.1.0",
      description:
        "Documentación interactiva para probar endpoints de OAuth, activación de tiendas, integración, holiday hours, pedidos y webhooks de Uber Eats."
    }
  };