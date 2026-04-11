export const ordersPaths = {
  "/uber/orders/{orderId}": {
    get: {
      tags: ["Orders"],
      summary: "Obtener detalle de una orden de Uber Eats",
      description:
        "Obtiene el detalle completo de una orden usando el endpoint de detalle configurado en la integración.",
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
      description: "Acepta el pedido usando POST /v1/eats/orders/{orderId}/accept_pos_order",
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
              properties: {
                reason: {
                  type: "string",
                  example: "Accepted by Rosie F."
                },
                pickup_time: {
                  type: "integer",
                  example: 1760000000
                },
                external_reference_id: {
                  type: "string",
                  example: "Check #146"
                },
                fields_relayed: {
                  type: "object",
                  properties: {
                    order_special_instructions: {
                      type: "boolean",
                      example: true
                    },
                    item_special_instructions: {
                      type: "boolean",
                      example: true
                    },
                    item_special_requests: {
                      type: "boolean",
                      example: true
                    },
                    promotions: {
                      type: "boolean",
                      example: true
                    }
                  }
                },
                order_pickup_instructions: {
                  type: "string",
                  example: "The lobby is closed, please use the drive-thru lane"
                }
              }
            },
            example: {
              reason: "Accepted by Rosie F.",
              external_reference_id: "Check #146",
              fields_relayed: {
                order_special_instructions: true,
                promotions: true
              },
              order_pickup_instructions:
                "The lobby is closed, please use the drive-thru lane"
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Pedido aceptado correctamente"
        },
        "204": {
          description: "Uber devolvió No Content"
        },
        "401": {
          description: "No autorizado"
        },
        "403": {
          description: "Acceso denegado a la orden"
        }
      }
    }
  },

  "/uber/orders/{orderId}/deny": {
    post: {
      tags: ["Orders"],
      summary: "Denegar pedido manualmente",
      description: "Deniega el pedido usando POST /v1/eats/orders/{orderId}/deny_pos_order",
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
              required: ["reason"],
              properties: {
                reason: {
                  type: "object",
                  required: ["explanation", "code"],
                  properties: {
                    explanation: {
                      type: "string",
                      example: "failed to submit order"
                    },
                    code: {
                      type: "string",
                      example: "ITEM_AVAILABILITY"
                    },
                    out_of_stock_items: {
                      type: "array",
                      items: {
                        type: "string"
                      },
                      example: [
                        "540cb880-0286-417b-9c6c-be586fd50f76",
                        "094f3308-4389-4ce5-bf30-ce9e09c6ed1c"
                      ]
                    },
                    invalid_items: {
                      type: "array",
                      items: {
                        type: "string"
                      },
                      example: [
                        "1cd26db9-6be3-4b0a-9216-e4868c5d79ec"
                      ]
                    }
                  }
                }
              }
            },
            example: {
              reason: {
                explanation: "failed to submit order",
                code: "ITEM_AVAILABILITY",
                out_of_stock_items: [
                  "540cb880-0286-417b-9c6c-be586fd50f76",
                  "094f3308-4389-4ce5-bf30-ce9e09c6ed1c"
                ],
                invalid_items: [
                  "1cd26db9-6be3-4b0a-9216-e4868c5d79ec"
                ]
              }
            }
          }
        }
      },
      responses: {
        "200": {
          description: "Pedido denegado correctamente"
        },
        "204": {
          description: "Uber devolvió No Content"
        },
        "401": {
          description: "No autorizado"
        },
        "403": {
          description: "Acceso denegado a la orden"
        }
      }
    }
  },

  "/uber/orders/{orderId}/cancel": {
    post: {
      tags: ["Orders"],
      summary: "Cancelar pedido manualmente",
      description: "Cancela el pedido usando POST /v1/eats/orders/{orderId}/cancel",
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
        },
        "204": {
          description: "Uber devolvió No Content"
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
                accept_payload: {
                  type: "object",
                  properties: {
                    reason: {
                      type: "string",
                      example: "Accepted by Rosie F."
                    },
                    pickup_time: {
                      type: "integer",
                      example: 1760000000
                    },
                    external_reference_id: {
                      type: "string",
                      example: "Check #146"
                    },
                    fields_relayed: {
                      type: "object",
                      properties: {
                        order_special_instructions: {
                          type: "boolean"
                        },
                        item_special_instructions: {
                          type: "boolean"
                        },
                        item_special_requests: {
                          type: "boolean"
                        },
                        promotions: {
                          type: "boolean"
                        }
                      }
                    },
                    order_pickup_instructions: {
                      type: "string",
                      example: "The lobby is closed, please use the drive-thru lane"
                    }
                  }
                },
                deny_payload: {
                  type: "object",
                  required: ["reason"],
                  properties: {
                    reason: {
                      type: "object",
                      required: ["explanation", "code"],
                      properties: {
                        explanation: {
                          type: "string",
                          example: "failed to submit order"
                        },
                        code: {
                          type: "string",
                          example: "ITEM_AVAILABILITY"
                        },
                        out_of_stock_items: {
                          type: "array",
                          items: {
                            type: "string"
                          }
                        },
                        invalid_items: {
                          type: "array",
                          items: {
                            type: "string"
                          }
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
              actions: ["get", "accept", "deny"],
              accept_payload: {
                reason: "Accepted by Rosie F.",
                external_reference_id: "Check #146",
                fields_relayed: {
                  order_special_instructions: true,
                  promotions: true
                },
                order_pickup_instructions:
                  "The lobby is closed, please use the drive-thru lane"
              },
              deny_payload: {
                reason: {
                  explanation: "failed to submit order",
                  code: "ITEM_AVAILABILITY",
                  out_of_stock_items: [
                    "540cb880-0286-417b-9c6c-be586fd50f76"
                  ],
                  invalid_items: [
                    "1cd26db9-6be3-4b0a-9216-e4868c5d79ec"
                  ]
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