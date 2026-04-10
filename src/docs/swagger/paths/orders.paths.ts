export const ordersPaths = {
  "/uber/orders/{orderId}": {
    get: {
      tags: ["Orders"],
      summary: "Obtener detalle de una orden de Uber Eats",
      description: "Obtiene el detalle completo de una orden usando app token con scope de órdenes.",
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: {
            type: "string"
          },
          description: "UUID de la orden de Uber Eats"
        }
      ],
      responses: {
        "200": {
          description: "Detalle de orden obtenido correctamente"
        },
        "400": {
          description: "Parámetros inválidos"
        },
        "500": {
          description: "Error interno del servidor"
        }
      }
    }
  },

  "/uber/stores/{storeId}/orders": {
    get: {
      tags: ["Orders"],
      summary: "Listar órdenes de una store de Uber Eats",
      parameters: [
        {
          name: "storeId",
          in: "path",
          required: true,
          schema: {
            type: "string"
          },
          description: "ID de la store de Uber Eats"
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
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string"
          }
        },
        {
          name: "start_time",
          in: "query",
          required: false,
          schema: {
            type: "string"
          }
        },
        {
          name: "end_time",
          in: "query",
          required: false,
          schema: {
            type: "string"
          }
        },
        {
          name: "page_size",
          in: "query",
          required: false,
          schema: {
            type: "number"
          }
        },
        {
          name: "expand",
          in: "query",
          required: false,
          schema: {
            type: "string"
          }
        }
      ],
      responses: {
        "200": {
          description: "Órdenes de la store obtenidas correctamente"
        }
      }
    }
  },

  "/uber/orders/{orderId}/accept": {
    post: {
      tags: ["Orders"],
      summary: "Aceptar pedido manualmente",
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: { type: "string" }
        }
      ],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                reason: { type: "string" },
                pickup_time: { type: "number" },
                external_reference_id: { type: "string" },
                order_pickup_instructions: { type: "string" }
              }
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Pedido aceptado correctamente"
        }
      }
    }
  },

  "/uber/orders/{orderId}/deny": {
    post: {
      tags: ["Orders"],
      summary: "Denegar pedido manualmente",
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: { type: "string" }
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["reason"],
              properties: {
                reason: {
                  type: "object",
                  required: ["explanation", "code"],
                  properties: {
                    explanation: { type: "string" },
                    code: { type: "string" },
                    out_of_stock_items: {
                      type: "array",
                      items: { type: "string" }
                    },
                    invalid_items: {
                      type: "array",
                      items: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Pedido denegado correctamente"
        }
      }
    }
  },

  "/uber/orders/{orderId}/cancel": {
    post: {
      tags: ["Orders"],
      summary: "Cancelar pedido manualmente",
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: { type: "string" }
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["reason"],
              properties: {
                reason: { type: "string" },
                details: { type: "string" },
                cancelling_party: { type: "string" }
              }
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Pedido cancelado correctamente"
        }
      }
    }
  },

  "/uber/orders/{orderId}/cart": {
    patch: {
      tags: ["Orders"],
      summary: "Actualizar pedido/cart",
      description: "Pasa el payload de patch cart tal cual hacia Uber.",
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: { type: "string" }
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object"
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Pedido actualizado correctamente"
        }
      }
    }
  },

  "/uber/orders/{orderId}/validate-flow": {
    post: {
      tags: ["Orders"],
      summary: "Ejecutar flujo de validación de Uber por pedido",
      parameters: [
        {
          name: "orderId",
          in: "path",
          required: true,
          schema: { type: "string" }
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["actions"],
              properties: {
                actions: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["get", "accept", "deny", "cancel", "update"]
                  }
                },
                accept_payload: { type: "object" },
                deny_payload: { type: "object" },
                cancel_payload: { type: "object" },
                update_payload: { type: "object" }
              }
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Flujo de validación ejecutado"
        }
      }
    }
  }
};