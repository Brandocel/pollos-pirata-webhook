export const webhookPaths = {
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
  };