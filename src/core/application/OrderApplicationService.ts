/**
 * OrderApplicationService
 *
 * Application-layer service orchestrating the checkout flow.
 * Depends exclusively on port interfaces — has zero knowledge of
 * Clerk, Stripe SDKs, or Supabase. Satisfies the Ports & Adapters contract.
 *
 * Architecture boundary: no vendor SDK imports are allowed here.
 * Adapters are injected at the composition root (main.tsx).
 */
import type { IPaymentService } from '../ports/IPaymentService';
import type { ShelfParams } from '../domain/types';

export interface CheckoutResult {
  url: string | null;
  error: Error | null;
}

export class OrderApplicationService {
  private readonly payment: IPaymentService;

  constructor(payment: IPaymentService) {
    this.payment = payment;
  }

  /**
   * Initiates a Stripe checkout session for the given shelf design.
   *
   * The webhook-only pattern is used: no pre-payment DB write occurs here.
   * The Express server's /api/webhook handler is responsible for persisting
   * the order to Supabase after payment.success is confirmed by Stripe.
   *
   * @param params  Full shelf design parameters (serialised as order metadata)
   * @param price   Calculated total price in GBP
   * @param userEmail  Optional — guest checkouts allowed (email captured post-payment)
   */
  async initiateCheckout(
    params: ShelfParams,
    price: number,
    userEmail: string | null,
  ): Promise<CheckoutResult> {
    if (price <= 0) {
      return { url: null, error: new Error('Invalid price: must be greater than zero') };
    }

    return this.payment.createCheckoutSession({ price, params, userEmail });
  }
}
