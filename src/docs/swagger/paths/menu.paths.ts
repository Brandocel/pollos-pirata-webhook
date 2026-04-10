export const menuPaths = {
    "/uber/stores/{storeId}/menu": {
      get: {
        tags: ["Menu"],
        summary: "Obtener menú de una store",
        description:
          "Endpoint interno auxiliar para consultar el menú actual y ubicar item_ids antes de usar Update Item.",
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
            },
            example: "211e6ead-0412-462c-90c3-37e40150ff40"
          },
          {
            name: "menu_type",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: [
                "MENU_TYPE_FULFILLMENT_DELIVERY",
                "MENU_TYPE_FULFILLMENT_PICK_UP",
                "MENU_TYPE_FULFILLMENT_DINE_IN"
              ]
            }
          }
        ],
        responses: {
          "200": {
            description: "Menú obtenido correctamente"
          }
        }
      },
  
      put: {
        tags: ["Menu"],
        summary: "Cargar o reemplazar el menú completo de una store",
        description:
          "Envía el menú completo a Uber. Este endpoint interno llama al Upload Menu oficial de Uber.",
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
            },
            example: "211e6ead-0412-462c-90c3-37e40150ff40"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UberMenuConfiguration"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Menú cargado correctamente"
          },
          "400": {
            description: "Body inválido"
          }
        }
      }
    },
  
    "/uber/stores/{storeId}/menu/items/{itemId}": {
      post: {
        tags: ["Menu"],
        summary: "Actualizar un item del menú",
        description:
          "Realiza sparse update sobre un item específico del menú. Debes haber ejecutado Upload Menu al menos una vez antes.",
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
            },
            example: "211e6ead-0412-462c-90c3-37e40150ff40"
          },
          {
            name: "itemId",
            in: "path",
            required: true,
            schema: {
              type: "string"
            },
            example: "item-combo-pirata"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UberUpdateMenuItemRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Item actualizado correctamente"
          },
          "400": {
            description: "Body inválido"
          }
        }
      }
    }
  };