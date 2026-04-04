import type { SupabaseClient } from '@supabase/supabase-js';
import type { IDatabaseService, Order } from '../../core/ports/IDatabaseService';

export const createSupabaseDatabaseAdapter = (client: SupabaseClient): IDatabaseService => ({
  saveOrder: async (order) => {
    const { data, error } = await client.from('orders').insert(order).select().single();
    if (error) throw error;
    return data as Order;
  },
  
  fetchOrders: async () => {
    const { data, error } = await client.from('orders').select('*');
    if (error) throw error;
    return data as Order[];
  }
});
