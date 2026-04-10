export const schemas = {
    UberWebhookEvent: {
      type: "object",
      properties: {
        event_type: {
          type: "string",
          example: "orders.notification"
        },
        event_id: {
          type: "string",
          example: "evt_123456"
        },
        event_time: {
          type: "number",
          example: 1711900000
        },
        meta: {
          type: "object",
          properties: {
            resource_id: {
              type: "string",
              example: "order_abc123"
            },
            status: {
              type: "string",
              example: "placed"
            },
            user_id: {
              type: "string",
              example: "user_001"
            }
          }
        },
        resource_href: {
          type: "string",
          example: "https://api.uber.com/v2/eats/order/order_abc123"
        }
      }
    },
  
    UberActivateStoreRequest: {
      type: "object",
      properties: {
        is_order_manager: {
          type: "boolean",
          example: true
        },
        integrator_store_id: {
          type: "string",
          example: "pollos-pirata-store-001"
        },
        integrator_brand_id: {
          type: "string",
          example: "pollos-pirata-brand-001"
        },
        merchant_store_id: {
          type: "string",
          example: "pollos-pirata-merchant-store-001"
        }
      }
    },
  
    UberUpdateStoreIntegrationRequest: {
      type: "object",
      properties: {
        is_order_manager: {
          type: "boolean",
          example: true
        },
        integrator_store_id: {
          type: "string",
          example: "pollos-pirata-store-002"
        },
        integrator_brand_id: {
          type: "string",
          example: "pollos-pirata-brand-002"
        },
        merchant_store_id: {
          type: "string",
          example: "pollos-pirata-merchant-store-002"
        }
      }
    },
  
    UberOpenTimePeriod: {
      type: "object",
      required: ["start_time", "end_time"],
      properties: {
        start_time: {
          type: "string",
          example: "09:00"
        },
        end_time: {
          type: "string",
          example: "14:00"
        }
      }
    },
  
    UberHolidayHour: {
      type: "object",
      properties: {
        open_time_periods: {
          type: "array",
          items: {
            $ref: "#/components/schemas/UberOpenTimePeriod"
          }
        }
      }
    },
  
    UberUpdateHolidayHoursRequest: {
      type: "object",
      required: ["holiday_hours"],
      properties: {
        holiday_hours: {
          type: "object",
          additionalProperties: {
            $ref: "#/components/schemas/UberHolidayHour"
          },
          example: {
            "2026-12-24": {
              open_time_periods: [
                {
                  start_time: "09:00",
                  end_time: "14:00"
                }
              ]
            },
            "2026-12-25": {
              open_time_periods: [
                {
                  start_time: "00:00",
                  end_time: "00:00"
                }
              ]
            }
          }
        }
      }
    },
  
    UberGetHolidayHoursResponse: {
      type: "object",
      properties: {
        holiday_hours: {
          type: "object",
          additionalProperties: {
            $ref: "#/components/schemas/UberHolidayHour"
          }
        }
      }
    },

    UberMenuConfiguration: {
      type: "object",
      required: ["menus", "categories", "items", "modifier_groups"],
      properties: {
        menu_type: {
          type: "string",
          enum: [
            "MENU_TYPE_FULFILLMENT_DELIVERY",
            "MENU_TYPE_FULFILLMENT_PICK_UP",
            "MENU_TYPE_FULFILLMENT_DINE_IN"
          ],
          example: "MENU_TYPE_FULFILLMENT_DELIVERY"
        },
        menus: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true
          }
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true
          }
        },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true
          }
        },
        modifier_groups: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    },
  
    UberUpdateMenuItemRequest: {
      type: "object",
      additionalProperties: true,
      example: {
        price_info: {
          price: 149900
        }
      }
    },

    UberMoney: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          example: 25900
        },
        currency_code: {
          type: "string",
          example: "MXN"
        },
        formatted_amount: {
          type: "string",
          example: "$259.00"
        }
      }
    },
    
    UberOrderLocation: {
      type: "object",
      properties: {
        title: {
          type: "string",
          example: "Casa"
        },
        street_address: {
          type: "string",
          example: "Av. Bonampak 123"
        },
        unit_number: {
          type: "string",
          nullable: true,
          example: "Depto 4B"
        },
        business_name: {
          type: "string",
          nullable: true,
          example: "Frente a la farmacia"
        },
        city: {
          type: "string",
          example: "Cancún"
        },
        state: {
          type: "string",
          example: "Quintana Roo"
        },
        postal_code: {
          type: "string",
          example: "77500"
        },
        country: {
          type: "string",
          example: "MX"
        }
      }
    },
    
    UberEaterDeliveryInfo: {
      type: "object",
      properties: {
        location: {
          $ref: "#/components/schemas/UberOrderLocation"
        }
      }
    },
    
    UberEater: {
      type: "object",
      properties: {
        first_name: {
          type: "string",
          example: "Juan"
        },
        last_name: {
          type: "string",
          example: "Pérez"
        },
        phone: {
          type: "string",
          example: "+529981234567"
        },
        delivery: {
          $ref: "#/components/schemas/UberEaterDeliveryInfo"
        }
      }
    },
    
    UberSelectedModifierItem: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "mod-item-1"
        },
        external_data: {
          type: "string",
          nullable: true,
          example: "EXTRA-Q"
        },
        title: {
          type: "string",
          example: "Queso extra"
        },
        quantity: {
          type: "number",
          example: 1
        },
        special_instructions: {
          type: "string",
          nullable: true,
          example: "Poner aparte"
        },
        selected_modifier_groups: {
          type: "array",
          items: {
            $ref: "#/components/schemas/UberModifierGroup"
          }
        }
      }
    },
    
    UberModifierGroup: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "group-1"
        },
        external_data: {
          type: "string",
          nullable: true,
          example: "TOPPINGS"
        },
        title: {
          type: "string",
          example: "Complementos"
        },
        selected_items: {
          type: "array",
          items: {
            $ref: "#/components/schemas/UberSelectedModifierItem"
          }
        }
      }
    },
    
    UberCartItemPrice: {
      type: "object",
      properties: {
        unit_price: {
          $ref: "#/components/schemas/UberMoney"
        },
        total_price: {
          $ref: "#/components/schemas/UberMoney"
        }
      }
    },
    
    UberCartItem: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "item-1"
        },
        external_data: {
          type: "string",
          nullable: true,
          example: "POLLO-ENTERO"
        },
        title: {
          type: "string",
          example: "Pollo entero"
        },
        quantity: {
          type: "number",
          example: 1
        },
        special_instructions: {
          type: "string",
          nullable: true,
          example: "Sin cebolla"
        },
        price: {
          $ref: "#/components/schemas/UberCartItemPrice"
        },
        selected_modifier_groups: {
          type: "array",
          items: {
            $ref: "#/components/schemas/UberModifierGroup"
          }
        }
      }
    },
    
    UberCart: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            $ref: "#/components/schemas/UberCartItem"
          }
        },
        special_instructions: {
          type: "string",
          nullable: true,
          example: "Tocar el timbre"
        }
      }
    },
    
    UberOrderChargeSummary: {
      type: "object",
      properties: {
        subtotal: {
          $ref: "#/components/schemas/UberMoney"
        },
        tax: {
          $ref: "#/components/schemas/UberMoney"
        },
        total: {
          $ref: "#/components/schemas/UberMoney"
        },
        delivery_fee: {
          $ref: "#/components/schemas/UberMoney"
        },
        service_fee: {
          $ref: "#/components/schemas/UberMoney"
        },
        small_order_fee: {
          $ref: "#/components/schemas/UberMoney"
        },
        tip: {
          $ref: "#/components/schemas/UberMoney"
        }
      }
    },
    
    UberPaymentInfo: {
      type: "object",
      properties: {
        charges: {
          $ref: "#/components/schemas/UberOrderChargeSummary"
        }
      }
    },
    
    UberOrderFulfillmentTime: {
      type: "object",
      properties: {
        ready_for_pickup_time: {
          type: "string",
          nullable: true,
          example: "2026-04-10T18:20:00Z"
        },
        pickup_time: {
          type: "string",
          nullable: true,
          example: "2026-04-10T18:30:00Z"
        },
        created_time: {
          type: "string",
          nullable: true,
          example: "2026-04-10T18:00:00Z"
        }
      }
    },
    
    UberOrderDetails: {
      type: "object",
      required: ["id"],
      properties: {
        id: {
          type: "string",
          example: "6f4dd8d9-d394-45e3-a132-b0c6ec8e11aa"
        },
        display_id: {
          type: "string",
          example: "A1B2C3"
        },
        external_reference_id: {
          type: "string",
          nullable: true,
          example: "POLLOS-PIRATA-ORDER-001"
        },
        current_state: {
          type: "string",
          example: "CREATED"
        },
        placed_at: {
          type: "string",
          nullable: true,
          example: "2026-04-10T18:00:00Z"
        },
        created_at: {
          type: "string",
          nullable: true,
          example: "2026-04-10T18:00:00Z"
        },
        type: {
          type: "string",
          nullable: true,
          example: "DELIVERY_BY_UBER"
        },
        eater: {
          $ref: "#/components/schemas/UberEater"
        },
        cart: {
          $ref: "#/components/schemas/UberCart"
        },
        payment: {
          $ref: "#/components/schemas/UberPaymentInfo"
        },
        fulfillment_time: {
          $ref: "#/components/schemas/UberOrderFulfillmentTime"
        }
      }
    },
    
    GetOrderDetailsResponse: {
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
  };