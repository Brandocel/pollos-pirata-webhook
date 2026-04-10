export const oauthPaths = {
    "/uber/auth/login": {
      get: {
        tags: ["OAuth"],
        summary: "Iniciar login OAuth con Uber",
        description:
          "Este endpoint redirige a Uber para iniciar OAuth. Debe abrirse directamente en el navegador y no desde Swagger Execute.",
        responses: {
          "302": {
            description: "Redirección a Uber OAuth"
          }
        }
      }
    },
  
    "/uber/auth/callback": {
      get: {
        tags: ["OAuth"],
        summary: "Callback OAuth de Uber",
        parameters: [
          {
            name: "code",
            in: "query",
            required: false,
            schema: {
              type: "string"
            }
          },
          {
            name: "state",
            in: "query",
            required: false,
            schema: {
              type: "string"
            }
          },
          {
            name: "error",
            in: "query",
            required: false,
            schema: {
              type: "string"
            }
          },
          {
            name: "error_description",
            in: "query",
            required: false,
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          "200": {
            description: "Merchant autenticado correctamente"
          }
        }
      }
    },
  
    "/uber/session": {
      get: {
        tags: ["OAuth"],
        summary: "Consultar si existe sesión merchant activa",
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          "200": {
            description: "Estado de sesión"
          },
          "401": {
            description: "Sesión inválida o expirada"
          }
        }
      }
    },
  
    "/uber/stores": {
      get: {
        tags: ["OAuth"],
        summary: "Obtener stores del merchant autenticado",
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          "200": {
            description: "Stores obtenidas correctamente"
          },
          "401": {
            description: "Sesión inválida o expirada"
          }
        }
      }
    },
  
    "/uber/stores/{storeId}/activate": {
      post: {
        tags: ["OAuth"],
        summary: "Activar una store con pos_data",
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            name: "storeId",
            in: "path",
            required: true,
            schema: {
              type: "string"
            }
          }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UberActivateStoreRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Store activada correctamente"
          },
          "401": {
            description: "Sesión inválida o expirada"
          }
        }
      }
    }
  };