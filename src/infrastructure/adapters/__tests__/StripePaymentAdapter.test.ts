/**
 * Unit tests for StripePaymentAdapter
 *
 * Mocks the global fetch API so no network calls are made.
 * Tests the success path, error paths, and malformed response handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StripePaymentAdapter } from '../StripePaymentAdapter';

const mockParams = {
  price: 150,
  params: { ribCount: 10 } as any,
  userEmail: 'customer@example.com',
};

describe('StripePaymentAdapter.createCheckoutSession', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a checkout URL on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ url: 'https://checkout.stripe.com/pay/cs_test_abc' }),
    } as any);

    const result = await StripePaymentAdapter.createCheckoutSession(mockParams);

    expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test_abc');
    expect(result.error).toBeNull();
  });

  it('returns error when API returns no URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ url: null }),
    } as any);

    const result = await StripePaymentAdapter.createCheckoutSession(mockParams);

    expect(result.url).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toContain('No Checkout URL');
  });

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network unreachable'));

    const result = await StripePaymentAdapter.createCheckoutSession(mockParams);

    expect(result.url).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe('Network unreachable');
  });

  it('returns error on malformed JSON response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => { throw new Error('Unexpected token'); },
    } as any);

    const result = await StripePaymentAdapter.createCheckoutSession(mockParams);

    expect(result.url).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });

  it('sends the correct request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ url: 'https://checkout.stripe.com/pay/cs_test_xyz' }),
    } as any);

    await StripePaymentAdapter.createCheckoutSession(mockParams);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/create-checkout-session'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockParams),
      }),
    );
  });
});
