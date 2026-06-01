export type ShippingMethod = 'correios' | 'uber_local' | 'local_pickup';

export type ShipmentStatus = 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled';

export interface ShippingOption {
  id: string;
  method: ShippingMethod;
  serviceName: string;
  costCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isLocal: boolean;
  carrierService?: string;
}

export interface CepInfo {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  isUberaba: boolean;
  error?: string;
}

export interface ShipmentRow {
  id: string;
  order_id: string;
  shipping_method: ShippingMethod;
  carrier_service?: string;
  tracking_code?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  shipping_cost_cents: number;
  pickup_address?: Record<string, unknown>;
  delivery_address: Record<string, unknown>;
  status: ShipmentStatus;
  external_tracking_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ShippingRateRow {
  id: string;
  method: ShippingMethod;
  service_name: string;
  is_local: boolean;
  base_cost_cents: number;
  weight_factor: number;
  distance_factor: number;
  max_weight_kg?: number;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean;
  created_at: string;
}

export interface TrackingInfo {
  status: string;
  lastUpdate: string;
  events: TrackingEvent[];
  estimatedDelivery?: string;
}

export interface TrackingEvent {
  date: string;
  description: string;
  location?: string;
}

export interface ShippingCalculationParams {
  cep: string;
  items: Array<{
    weight?: number;
    quantity: number;
  }>;
  totalWeight?: number;
}