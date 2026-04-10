export const ordersPaths = {
  "/uber/orders/{orderId}": {
    get: {
      tags: ["Orders"],
      summary: "Obtener detalle de una orden de Uber Eats",
      description:
        "Obtiene el detalle completo de una orden usando delivery/order y fallback a eats/order.",
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
      description: "Acepta el pedido usando POST /v1/delivery/order/{orderId}/accept",
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
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              example: {}
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
      description: "Deniega el pedido usando POST /v1/delivery/order/{orderId}/deny",
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
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["deny_reason"],
              properties: {
                deny_reason: {
                  type: "object",
                  required: ["code"],
                  properties: {
                    code: {
                      type: "string",
                      example: "OTHER"
                    },
                    description: {
                      type: "string",
                      example: "Store is unable to fulfill the order"
                    }
                  }
                }
              }
            },
            example: {
              deny_reason: {
                code: "OTHER",
                description: "Store is unable to fulfill the order"
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
      description: "Cancela el pedido usando POST /v1/delivery/order/{orderId}/cancel",
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
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["cancellation_reason"],
              properties: {
                cancellation_reason: {
                  type: "object",
                  required: ["code"],
                  properties: {
                    code: {
                      type: "string",
                      example: "CUSTOMER_CALLED_TO_CANCEL"
                    },
                    description: {
                      type: "string",
                      example: "Customer requested cancellation by phone"
                    }
                  }
                }
              }
            },
            example: {
              cancellation_reason: {
                code: "CUSTOMER_CALLED_TO_CANCEL",
                description: "Customer requested cancellation by phone"
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
          schema: {
            type: "string"
          }
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
          schema: {
            type: "string"
          }
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
                deny_payload: {
                  type: "object",
                  properties: {
                    deny_reason: {
                      type: "object",
                      required: ["code"],
                      properties: {
                        code: {
                          type: "string",
                          example: "OTHER"
                        },
                        description: {
                          type: "string",
                          example: "Store is unable to fulfill the order"
                        }
                      }
                    }
                  }
                },
                cancel_payload: {
                  type: "object",
                  properties: {
                    cancellation_reason: {
                      type: "object",
                      required: ["code"],
                      properties: {
                        code: {
                          type: "string",
                          example: "CUSTOMER_CALLED_TO_CANCEL"
                        },
                        description: {
                          type: "string",
                          example: "Customer requested cancellation by phone"
                        }
                      }
                    }
                  }
                },
                update_payload: {
                  type: "object"
                }
              }
            },
            example: {
              actions: ["get", "deny", "cancel"],
              deny_payload: {
                deny_reason: {
                  code: "OTHER",
                  description: "Store is unable to fulfill the order"
                }
              },
              cancel_payload: {
                cancellation_reason: {
                  code: "CUSTOMER_CALLED_TO_CANCEL",
                  description: "Customer requested cancellation by phone"
                }
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