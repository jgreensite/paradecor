export interface CheckoutParams {
  price: number;
  params: any;
  userEmail?: string | null;
  userId?: string | null;
}

export interface IPaymentService {
  /** Method wrapping the integration with a payment provider to initiate a checkout */
  createCheckoutSession(params: CheckoutParams): Promise<{ url: string | null; error: Error | null }>;
}
