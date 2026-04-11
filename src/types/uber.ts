export interface UberWebhookEvent {
  event_type: string;
  event_id: string;
  event_time: number;
  meta?: {
    resource_id?: string;
    status?: string;
    user_id?: string;
  };
  resource_href?: string;
}

export interface UberMoney {
  amount?: number;
  currency_code?: string;
  formatted_amount?: string;
}

export interface UberOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface UberStore {
  name?: string;
  store_id: string;
  status?: string;
  partner_store_id?: string;
  timezone?: string;
  merchant_store_id?: string;
  pos_data?: {
    integration_enabled?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface UberActivateStoreRequest {
  is_order_manager?: boolean;
  integrator_store_id?: string;
  integrator_brand_id?: string;
  merchant_store_id?: string;
}

export interface UberUpdateStoreIntegrationRequest {
  is_order_manager?: boolean;
  integrator_store_id?: string;
  integrator_brand_id?: string;
  merchant_store_id?: string;
}

export interface UberStoreIntegrationDetails {
  store_id: string;
  is_order_manager?: boolean;
  integrator_store_id: string | null;
  integrator_brand_id: string | null;
  merchant_store_id: string | null;
  integration_enabled?: boolean;
  order_manager_client_id?: string | null;
  raw?: unknown;
}

export interface UberStorePosDataResponse {
  store_id?: string;
  integration_enabled?: boolean;
  pos_integration_enabled?: boolean;
  is_order_manager?: boolean;
  order_manager_client_id?: string | null;
  integrator_store_id?: string | null;
  integrator_brand_id?: string | null;
  merchant_store_id?: string | null;
  [key: string]: unknown;
}

export interface UberOpenTimePeriod {
  start_time: string;
  end_time: string;
}

export interface UberHolidayHour {
  open_time_periods?: UberOpenTimePeriod[];
}

export interface UberHolidayHoursMap {
  [date: string]: UberHolidayHour;
}

export interface UberUpdateHolidayHoursRequest {
  holiday_hours: UberHolidayHoursMap;
}

export interface UberGetHolidayHoursResponse {
  holiday_hours: UberHolidayHoursMap;
}

export type UberMenuType =
  | "MENU_TYPE_FULFILLMENT_DELIVERY"
  | "MENU_TYPE_FULFILLMENT_PICK_UP"
  | "MENU_TYPE_FULFILLMENT_DINE_IN";

export interface UberMenuConfiguration {
  menus: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  items: Record<string, unknown>[];
  modifier_groups: Record<string, unknown>[];
  menu_type?: UberMenuType;
}

export type UberGetMenuResponse = UberMenuConfiguration;

export interface UberUpdateMenuItemRequest extends Record<string, unknown> {
  price_info?: Record<string, unknown>;
  suspension_info?: Record<string, unknown>;
  tax_info?: Record<string, unknown>;
}

export interface UberItemPrice {
  unit_price?: UberMoney;
  total_price?: UberMoney;
  base_unit_price?: UberMoney;
}

export interface UberAllergen {
  type?: string;
  freeform_text?: string;
}

export interface UberAllergy {
  allergens_to_exclude?: UberAllergen[];
  allergy_instructions?: string;
}

export interface UberSpecialRequest {
  allergy?: UberAllergy;
}

export interface UberModifierGroupItem {
  id?: string;
  title?: string;
  quantity?: number;
  price?: UberItemPrice;
  selected_modifier_groups?: UberModifierGroup[] | null;
  special_instructions?: string;
  instance_id?: string;
  external_data?: string;
}

export interface UberModifierGroup {
  id?: string;
  title?: string;
  external_data?: string;
  selected_items?: UberModifierGroupItem[];
}

export interface UberCartItem {
  id?: string;
  instance_id?: string;
  title?: string;
  external_data?: string;
  quantity?: number;
  price?: UberItemPrice;
  selected_modifier_groups?: UberModifierGroup[] | null;
  special_requests?: UberSpecialRequest[];
  default_quantity?: number;
  special_instructions?: string;
}

export interface UberCart {
  items?: UberCartItem[];
  special_instructions?: string;
}

export interface UberLocation {
  type?: "STREET_ADDRESS" | "GOOGLE_PLACE" | string;
  street_address?: string;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
  unit_number?: string;
  business_name?: string;
  title?: string;
}

export interface UberDeliveryInfo {
  location?: UberLocation;
  type?: "DELIVER_TO_DOOR" | "CURBSIDE" | "LEAVE_AT_DOOR" | string;
}

export interface UberEater {
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_code?: string;
  id?: string;
  delivery?: UberDeliveryInfo;
}

export interface UberCharges {
  total?: UberMoney;
  sub_total?: UberMoney;
  tax?: UberMoney;
  total_fee?: UberMoney;
  cash_amount_due?: UberMoney;
  tip?: UberMoney;
  delivery_fee?: UberMoney;
  small_order_fee?: UberMoney;
  bag_fee?: UberMoney;
}

export interface UberPayment {
  charges?: UberCharges;
}

export interface UberStoreReference {
  id?: string;
  store_id?: string;
  name?: string;
  external_reference_id?: string;
  integrator_store_id?: string;
  integrator_brand_id?: string;
  merchant_store_id?: string;
  [key: string]: unknown;
}

export interface UberOrderDetails {
  id: string;
  display_id?: string;
  external_reference_id?: string;
  current_state?: string;
  placed_at?: string;
  created_at?: string;
  brand?: string;
  type?: string;
  fulfillment_type?: string;
  store?: UberStoreReference;
  eater?: UberEater;
  eaters?: UberEater[];
  cart?: UberCart;
  payment?: UberPayment;
  fulfillment_time?: {
    ready_for_pickup_time?: string;
    pickup_time?: string;
    created_time?: string;
  };
  raw?: unknown;
}