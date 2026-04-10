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
    }
  };