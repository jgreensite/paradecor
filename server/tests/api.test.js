import request from 'supertest';
import { jest } from '@jest/globals';

// Mock Supabase
jest.unstable_mockModule('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'mock-order-123' },
        error: null
      })
    }))
  };
});

// Mock Stripe to prevent real API calls during tests
jest.unstable_mockModule('stripe', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_test_mock123',
            url: 'https://checkout.stripe.com/pay/cs_test_mock123'
          })
        }
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_test_mock123', metadata: { shelfParams: '{}' } } }
        })
      }
    }))
  };
});

// Import app after mocking
const { default: app } = await import('../server.js');

describe('Rybform Backend API', () => {
  
  describe('GET /health', () => {
    it('should return 200 OK and status message', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        message: 'Rybform Server Running'
      });
    });
  });

  describe('POST /api/create-checkout-session', () => {
    it('should return a 200 and a mock checkout URL when given valid parameters', async () => {
      const mockPayload = {
        price: 150,
        params: {
          ribCount: 20,
          material: 'plywood',
          length: { value: 1000, unit: 'mm' },
          height: { value: 300, unit: 'mm' }
        }
      };

      const response = await request(app)
        .post('/api/create-checkout-session')
        .send(mockPayload)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'cs_test_mock123');
      expect(response.body).toHaveProperty('url', 'https://checkout.stripe.com/pay/cs_test_mock123');
    });

    it('should return 500 when parameters are improperly structured causing Stripe exceptions', async () => {
      // Sending empty payload to cause a crash when accessing params.length
      const response = await request(app)
        .post('/api/create-checkout-session')
        .send({})
        .set('Accept', 'application/json');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/webhook', () => {
    it('should process Stripe signature and return 200', async () => {
      // In a real scenario Stripe sends raw buffers. Supertest sends text.
      const response = await request(app)
        .post('/api/webhook')
        .set('stripe-signature', 't=123,v1=mock')
        .send('{"id":"evt_test"}')
        .type('application/json');

      expect(response.status).toBe(200);
    });
  });
});
