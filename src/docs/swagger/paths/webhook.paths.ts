export const webhookPaths = {
  "/webhooks/uber/webhook": {
    get: {
      tags: ["Webhooks"],
      summary: "Health check del webhook de Uber",
      responses: {
        "200": {
          description: "Webhook disponible"
        }
      }
    },
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
  },

  "/webhooks/uber/webhook/last-state": {
    get: {
      tags: ["Webhooks"],
      summary: "Consultar el último estado del webhook",
      responses: {
        "200": {
          description: "Último estado obtenido correctamente"
        }
      }
    }
  },

  "/webhooks/uber/webhook/history": {
    get: {
      tags: ["Webhooks"],
      summary: "Consultar historial reciente de webhooks",
      parameters: [
        {
          name: "limit",
          in: "query",
          required: false,
          schema: {
            type: "number"
          }
        }
      ],
      responses: {
        "200": {
          description: "Historial obtenido correctamente"
        }
      }
    },
    delete: {
      tags: ["Webhooks"],
      summary: "Limpiar historial de webhooks",
      responses: {
        "200": {
          description: "Historial limpiado correctamente"
        }
      }
    }
  },

  "/webhooks/uber/webhook/evidence": {
    get: {
      tags: ["Webhooks"],
      summary: "Obtener evidencia técnica final del webhook",
      responses: {
        "200": {
          description: "Evidencia técnica obtenida correctamente"
        }
      }
    }
  }
};