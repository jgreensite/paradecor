import request from 'supertest';
import { jest } from '@jest/globals';

const mockCreateSession = jest.fn();
const mockConstructEvent = jest.fn();
const mockCreateInvitation = jest.fn();

const dbState = {
  lastInsertRows: null,
  lastUpdatePayload: null,
  lastEq: null,
  selectResult: { data: { status: 'awaiting_approval' }, error: null },
  updateResult: { error: null },
};

const queryBuilder = {
  operation: null,
  insert: jest.fn((rows) => {
    queryBuilder.operation = 'insert';
    dbState.lastInsertRows = rows;
    return queryBuilder;
  }),
  select: jest.fn(() => {
    if (queryBuilder.operation !== 'insert') {
      queryBuilder.operation = 'select';
    }
    return queryBuilder;
  }),
  update: jest.fn((payload) => {
    queryBuilder.operation = 'update';
    dbState.lastUpdatePayload = payload;
    return queryBuilder;
  }),
  eq: jest.fn((field, value) => {
    dbState.lastEq = { field, value };
    if (queryBuilder.operation === 'update') {
      return Promise.resolve(dbState.updateResult);
    }
    return queryBuilder;
  }),
  single: jest.fn(async () => {
    if (queryBuilder.operation === 'insert') {
      return {
        data: { id: 'mock-order-123' },
        error: null,
      };
    }

    if (queryBuilder.operation === 'select') {
      return dbState.selectResult;
    }

    return { data: null, error: null };
  }),
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => {
      queryBuilder.operation = null;
      return queryBuilder;
    }),
  })),
}));

jest.unstable_mockModule('stripe', () => ({
  default: jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateSession,
      },
    },
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  })),
}));

jest.unstable_mockModule('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    invitations: {
      createInvitation: mockCreateInvitation,
    },
  })),
}));

const { default: app } = await import('../server.js');

const validPayload = {
  price: 1,
  params: {
    ribCount: 10,
    material: 'birch-plywood',
    finish: 'raw',
    length: { value: 48, unit: 'in' },
    height: { value: 24, unit: 'in' },
    ribX: {
      physical: { value: 150, unit: 'mm' },
      factor: 1,
    },
    ribY: {
      physical: { value: 150, unit: 'mm' },
      factor: 1,
    },
    backplaneBezier: null,
  },
};

describe('Rybform Backend API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbState.lastInsertRows = null;
    dbState.lastUpdatePayload = null;
    dbState.lastEq = null;
    dbState.selectResult = { data: { status: 'awaiting_approval' }, error: null };
    dbState.updateResult = { error: null };

    mockCreateSession.mockResolvedValue({
      id: 'cs_test_mock123',
      url: 'https://checkout.stripe.com/pay/cs_test_mock123',
    });

    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_mock123',
          metadata: {
            orderId: 'mock-order-123',
            userId: '',
          },
          customer_details: {
            email: 'guest@example.com',
          },
        },
      },
    });

    mockCreateInvitation.mockResolvedValue({});
  });

  describe('GET /health', () => {
    it('should return 200 OK and status message', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        message: 'Rybform Server Running',
      });
    });
  });

  describe('POST /api/create-checkout-session', () => {
    it('recomputes the amount on the server instead of trusting the client price', async () => {
      const response = await request(app)
        .post('/api/create-checkout-session')
        .send(validPayload)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'cs_test_mock123');
      expect(response.body).toHaveProperty('url', 'https://checkout.stripe.com/pay/cs_test_mock123');

      const sessionOptions = mockCreateSession.mock.calls[0][0];
      expect(sessionOptions.line_items[0].price_data.unit_amount).toBe(10000);
      expect(dbState.lastInsertRows[0].design_payload).toEqual(validPayload.params);
    });

    it('returns 400 when the payload does not satisfy the checkout schema', async () => {
      const response = await request(app)
        .post('/api/create-checkout-session')
        .send({})
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request data');
    });
  });

  describe('POST /api/webhook', () => {
    it('should process Stripe signature and return 200 on a successful order update', async () => {
      const response = await request(app)
        .post('/api/webhook')
        .set('stripe-signature', 't=123,v1=mock')
        .send('{"id":"evt_test"}')
        .type('application/json');

      expect(response.status).toBe(200);
      expect(dbState.lastUpdatePayload).toEqual({
        status: 'approved',
        stripe_payment_id: 'cs_test_mock123',
        customer_email: 'guest@example.com',
      });
      expect(mockCreateInvitation).toHaveBeenCalledWith({
        emailAddress: 'guest@example.com',
        redirectUrl: expect.any(String),
        ignoreExisting: true,
      });
    });

    it('returns 500 so Stripe can retry when the order update fails', async () => {
      dbState.updateResult = { error: { message: 'write failed' } };

      const response = await request(app)
        .post('/api/webhook')
        .set('stripe-signature', 't=123,v1=mock')
        .send('{"id":"evt_test"}')
        .type('application/json');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Order update failed');
    });
  });
});
