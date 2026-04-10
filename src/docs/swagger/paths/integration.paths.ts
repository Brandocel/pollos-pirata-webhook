export const integrationPaths = {
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