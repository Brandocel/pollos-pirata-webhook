import { Express } from "express";
import swaggerUi from "swagger-ui-express";

function getServerUrl(): string {
  const port = Number(process.env.PORT || 3000);

  return (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    `http://localhost:${port}`
  );
}

const serverUrl = getServerUrl();
const isProduction = process.env.NODE_ENV === "production";

const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Pollos Pirata - Uber Eats Integration API",
    version: "1.0.0",
    description:
      "Documentación interactiva para probar los endpoints de OAuth, activación de tiendas, configuración de integración, webhooks y consulta de pedidos de Uber Eats."
  },
  servers: [
    {
      url: serverUrl,
      description: isProduction ? "Servidor Render" : "Servidor local"
    }
  ],
  tags: [
    {
      name: "Health",
      description: "Verificación de estado del servidor"
    },
    {
      name: "OAuth",
      description: "Autenticación del merchant con Uber"
    },
    {
      name: "Stores",
      description: "Consulta, activación y configuración de integración de tiendas"
    },
    {
      name: "Orders",
      description: "Consulta manual de pedidos"
    },
    {
      name: "Webhooks",
      description: "Recepción de eventos de Uber Eats"
    }
  ],
  paths: {
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
    },
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
        tags: ["Stores"],
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
        tags: ["Stores"],
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
    },
    "/uber/stores/{storeId}/integration": {
      get: {
        tags: ["Stores"],
        summary: "Obtener detalle de integración de una store",
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
        responses: {
          "200": {
            description: "Detalle de integración obtenido correctamente"
          },
          "401": {
            description: "Sesión inválida o expirada"
          },
          "404": {
            description: "No se encontró la integración de la store"
          }
        }
      },
      put: {
        tags: ["Stores"],
        summary: "Actualizar detalle de integración de una store",
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
                $ref: "#/components/schemas/UberUpdateStoreIntegrationRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Integración actualizada correctamente"
          },
          "204": {
            description: "Integración actualizada sin contenido"
          },
          "401": {
            description: "Sesión inválida o expirada"
          }
        }
      },
      delete: {
        tags: ["Stores"],
        summary: "Remover integración de una store",
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
        responses: {
          "200": {
            description: "Integración removida correctamente"
          },
          "204": {
            description: "Integración removida sin contenido"
          },
          "401": {
            description: "Sesión inválida o expirada"
          }
        }
      }
    },
    "/uber/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "Consultar un pedido manualmente",
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          "200": {
            description: "Pedido obtenido correctamente"
          },
          "401": {
            description: "Sesión inválida o expirada"
          }
        }
      }
    },
    "/webhooks/uber/webhook": {
      post: {
        tags: ["Webhooks"],
        summary: "Recibir webhook de Uber Eats",
        parameters: [
          {
            name: "X-Uber-Signature",
            in: "header",
            required: false,
            schema: {
              type: "string"
            },
            description: "Firma HMAC-SHA256 enviada por Uber"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UberWebhookEvent"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Webhook recibido correctamente"
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Pega aquí el session_token generado por /uber/auth/callback. Swagger enviará Authorization: Bearer <token>."
      }
    },
    schemas: {
      UberWebhookEvent: {
        type: "object",
        properties: {
          event_type: {
            type: "string",
            example: "orders.notification"
          },
          event_id: {
            type: "string",
            example: "evt_123456"
          },
          event_time: {
            type: "number",
            example: 1711900000
          },
          meta: {
            type: "object",
            properties: {
              resource_id: {
                type: "string",
                example: "order_abc123"
              },
              status: {
                type: "string",
                example: "placed"
              },
              user_id: {
                type: "string",
                example: "user_001"
              }
            }
          },
          resource_href: {
            type: "string",
            example: "https://api.uber.com/v2/eats/order/order_abc123"
          }
        }
      },
      UberActivateStoreRequest: {
        type: "object",
        properties: {
          is_order_manager: {
            type: "boolean",
            example: true
          },
          integrator_store_id: {
            type: "string",
            example: "pollos-pirata-store-001"
          },
          integrator_brand_id: {
            type: "string",
            example: "pollos-pirata-brand-001"
          },
          merchant_store_id: {
            type: "string",
            example: "pollos-pirata-merchant-store-001"
          }
        }
      },
      UberUpdateStoreIntegrationRequest: {
        type: "object",
        properties: {
          is_order_manager: {
            type: "boolean",
            example: true
          },
          integrator_store_id: {
            type: "string",
            example: "pollos-pirata-store-002"
          },
          integrator_brand_id: {
            type: "string",
            example: "pollos-pirata-brand-002"
          },
          merchant_store_id: {
            type: "string",
            example: "pollos-pirata-merchant-store-002"
          }
        }
      }
    }
  }
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