export const integrationPaths = {
  "/uber/stores": {
    get: {
      tags: ["Integration"],
      summary: "Obtener stores autorizadas para el usuario merchant",
      description:
        "Requisito Uber: Integration Config - Get stores to User. Usa el merchant session token generado después del OAuth login para consultar GET /v1/eats/stores con el access token del usuario.",
      security: [
        {
          bearerAuth: []
        }
      ],
      parameters: [
        {
          name: "x-merchant-session-token",
          in: "header",
          required: false,
          schema: {
            type: "string"
          },
          description:
            "Opcional. Merchant session token generado por la app. También puede enviarse como Authorization: Bearer <token>."
        },
        {
          name: "sessionToken",
          in: "query",
          required: false,
          schema: {
            type: "string"
          },
          description:
            "Opcional solo para pruebas rápidas. Se recomienda usar Authorization o x-merchant-session-token."
        }
      ],
      responses: {
        "200": {
          description: "Stores autorizadas para el usuario obtenidas correctamente"
        },
        "401": {
          description: "Sesión merchant faltante, inválida o expirada"
        },
        "500": {
          description: "Error consultando stores en Uber"
        }
      }
    }
  },

  "/uber/stores/{storeId}/integration": {
    get: {
      tags: ["Integration"],
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
        "404": {
          description: "No se encontró la integración de la store"
        }
      }
    },

    put: {
      tags: ["Integration"],
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
        }
      }
    },

    delete: {
      tags: ["Integration"],
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
        }
      }
    }
  }
};