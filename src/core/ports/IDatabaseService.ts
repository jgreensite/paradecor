import type { ShelfParams } from '../domain/types';

/**
 * Order — mirrors the authoritative orders_schema.sql.
 *
 * customer_email and stripe_payment_id are nullable to support
 * guest checkout flows where email is captured post-payment via webhook.
 */
export interface Order {
  id: string;
  customer_email: string | null;
  status: 'awaiting_approval' | 'approved' | 'in_production' | 'shipped';
  is_custom_design: boolean;
  design_payload: ShelfParams | Record<string, unknown>;
  stripe_payment_id: string | null;
  created_at?: string;
}

export interface IDatabaseService {
  saveOrder(order: Omit<Order, 'id' | 'created_at'>): Promise<Order>;
  fetchOrders(): Promise<Order[]>;
}
