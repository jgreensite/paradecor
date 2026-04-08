import request from 'supertest';
import { jest } from '@jest/globals';

const mockCreateSession = jest.fn();
const mockConstructEvent = jest.fn();

const queryBuilder = {
  operation: null,
  insert: jest.fn(() => {
    queryBuilder.operation = 'insert';
    return queryBuilder;
  }),
  select: jest.fn(() => {
    if (queryBuilder.operation !== 'insert') {
      queryBuilder.operation = 'select';
    }
    return queryBuilder;
  }),
  update: jest.fn(() => {
    queryBuilder.operation = 'update';
    return queryBuilder;
  }),
  eq: jest.fn(() => {
    if (queryBuilder.operation === 'update') {
      return Promise.resolve({ error: null });
    }
    return queryBuilder;
  }),
  single: jest.fn(async () => {
    if (queryBuilder.operation === 'insert') {
      return { data: { id: 'mock-order-uuid' }, error: null };
    }

    return { data: { status: 'awaiting_approval' }, error: null };
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
      createInvitation: jest.fn(),
    },
  })),
}));

const { default: app } = await import('../server.js');

describe('Express Backend Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockResolvedValue({
      id: 'cs_test_mock123',
      url: 'https://checkout.stripe.com/mock-url',
    });
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_mock123',
          metadata: {
            orderId: 'mock-order-uuid',
            userId: '',
          },
        },
      },
    });
  });

  it('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('ok');
  });

  it('POST /api/create-checkout-session rejects an empty body with a validation error', async () => {
    const res = await request(app)
      .post('/api/create-checkout-session')
      .send({});

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Invalid request data');
  });
});
