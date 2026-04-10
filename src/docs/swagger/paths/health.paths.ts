export const healthPaths = {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Verificar estado del servidor",
        responses: {
          "200": {
            description: "Servidor funcionando correctamente"
          }
        }
      }
    }
  };