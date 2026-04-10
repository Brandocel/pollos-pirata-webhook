export const ordersPaths = {
    "/webhooks/uber/orders/{orderId}": {
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
          }
        }
      }
    }
  };