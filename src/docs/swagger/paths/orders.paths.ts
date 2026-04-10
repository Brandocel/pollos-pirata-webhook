export const ordersPaths = {
  "/uber/orders/{orderId}": {
    get: {
      tags: ["Orders"],
      summary: "Get Order Details",
      description:
        "Obtiene el detalle completo de una orden de Uber Eats usando app token con scope de órdenes.",
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: {
            type: "string"
          },
          description: "ID de la orden de Uber Eats",
          example: "6f4dd8d9-d394-45e3-a132-b0c6ec8e11aa"
        }
      ],
      responses: {
        "200": {
          description: "Detalle de orden obtenido correctamente",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: {
                    type: "boolean",
                    example: true
                  },
                  message: {
                    type: "string",
                    example: "Detalle de orden obtenido correctamente"
                  },
                  data: {
                    $ref: "#/components/schemas/UberOrderDetails"
                  }
                }
              }
            }
          }
        },
        "400": {
          description: "Falta el orderId o el formato es inválido",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: {
                    type: "boolean",
                    example: false
                  },
                  message: {
                    type: "string",
                    example: "Falta el orderId o el formato es inválido"
                  }
                }
              }
            }
          }
        },
        "404": {
          description: "Orden no encontrada"
        },
        "500": {
          description: "Error interno del servidor"
        }
      }
    }
  }
};