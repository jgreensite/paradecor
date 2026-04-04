import type { IPaymentService, CheckoutParams } from '../../core/ports/IPaymentService';

export const StripePaymentAdapter: IPaymentService = {
  createCheckoutSession: async (params: CheckoutParams) => {
    try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        
        const data = await response.json();
        if (data.url) {
            return { url: data.url, error: null };
        } else {
            return { url: null, error: new Error('No Checkout URL returned') };
        }
    } catch (error) {
        console.error('[Stripe Adapter] Failed to fetch create-checkout-session:', error);
        return { url: null, error: error as Error };
    }
  }
};
