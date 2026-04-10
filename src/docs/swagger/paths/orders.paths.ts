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
      description:
        "Endpoint temporal de diagnóstico para verificar si una compra sí fue creada aunque el webhook no se haya visto en logs.",
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
          },
          description: "Filtro por estado de la orden"
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string"
          },
          description: "Filtro por status de la orden"
        },
        {
          name: "start_time",
          in: "query",
          required: false,
          schema: {
            type: "string"
          },
          description: "RFC3339. Filtra órdenes desde esta fecha"
        },
        {
          name: "end_time",
          in: "query",
          required: false,
          schema: {
            type: "string"
          },
          description: "RFC3339. Filtra órdenes hasta esta fecha"
        },
        {
          name: "page_size",
          in: "query",
          required: false,
          schema: {
            type: "number"
          },
          description: "Cantidad de órdenes por página"
        },
        {
          name: "expand",
          in: "query",
          required: false,
          schema: {
            type: "string"
          },
          description: "Ejemplo: carts,payment"
        }
      ],
      responses: {
        "200": {
          description: "Órdenes de la store obtenidas correctamente"
        },
        "400": {
          description: "Parámetros inválidos"
        },
        "500": {
          description: "Error interno del servidor"
        }
      }
    }
  }
};