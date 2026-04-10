export const storePaths = {
    "/uber/stores/{storeId}/holiday-hours": {
      get: {
        tags: ["Store"],
        summary: "Obtener holiday hours de una store",
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
        responses: {
          "200": {
            description: "Holiday hours obtenidos correctamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UberGetHolidayHoursResponse"
                }
              }
            }
          }
        }
      },
  
      post: {
        tags: ["Store"],
        summary: "Actualizar holiday hours de una store",
        description:
          "Sobrescribe por completo los holiday hours existentes en Uber para la store indicada.",
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
                $ref: "#/components/schemas/UberUpdateHolidayHoursRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Holiday hours actualizados correctamente"
          },
          "400": {
            description: "Body inválido"
          }
        }
      }
    }
  };