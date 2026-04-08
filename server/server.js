import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from './middleware/requireAuth.js';

dotenv.config();

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

const MM_PER_INCH = 25.4;

const MATERIAL_PRICES = {
  mdf: 45,
  'birch-plywood': 65,
  'walnut-plywood': 85,
  'white-pvc': 55,
};
const MATERIAL_IDS = ['mdf', 'birch-plywood', 'walnut-plywood', 'white-pvc'];

const FINISH_PRICES = {
  raw: 0,
  'matte-white': 15,
  'matte-black': 15,
  gloss: 25,
  'natural-oil': 20,
};
const FINISH_IDS = ['raw', 'matte-white', 'matte-black', 'gloss', 'natural-oil'];

const toMM = (dimension) => {
  if (!dimension || typeof dimension.value !== 'number' || !dimension.unit) {
    throw new Error('Invalid dimension payload');
  }

  return dimension.unit === 'mm' ? dimension.value : dimension.value * MM_PER_INCH;
};

const calculateSheetsNeeded = (params) => {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor;
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor;
  const totalArea = widthMM * heightMM * params.ribCount;
  const sheetArea = 48 * 96 * MM_PER_INCH * MM_PER_INCH;
  return Math.max(1, Math.ceil(totalArea / sheetArea));
};

const calculateCheckoutPrice = (params) => {
  const materialPrice = MATERIAL_PRICES[params.material];
  const finishPrice = FINISH_PRICES[params.finish];

  if (typeof materialPrice !== 'number') {
    throw new Error(`Unsupported material: ${params.material}`);
  }

  if (typeof finishPrice !== 'number') {
    throw new Error(`Unsupported finish: ${params.finish}`);
  }

  const sheets = calculateSheetsNeeded(params);
  return materialPrice * sheets + finishPrice * params.ribCount + 35;
};

// Zod Schema for Checkout Session
const checkoutSchema = z.object({
  params: z.object({
    length: z.object({ value: z.number(), unit: z.string() }),
    height: z.object({ value: z.number(), unit: z.string() }),
    ribX: z.object({
      physical: z.object({ value: z.number().positive(), unit: z.enum(['mm', 'in']) }),
      factor: z.number().positive(),
    }),
    ribY: z.object({
      physical: z.object({ value: z.number().positive(), unit: z.enum(['mm', 'in']) }),
      factor: z.number().positive(),
    }),
    materialThickness: z.object({ value: z.number().positive(), unit: z.enum(['mm', 'in']) }).optional(),
    ribCount: z.number().min(1).max(100),
    material: z.enum(MATERIAL_IDS),
    finish: z.enum(FINISH_IDS),
    backplaneBezier: z.any().nullable().optional(),
  }),
  price: z.number().positive(),
  userEmail: z.string().email().optional(),
  userId: z.string().optional(),
});
// --- Webhook Endpoint ---
// Stripe requires the raw body to verify the signature
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`Payment successful for session ${session.id}!`);
      
      const orderId = session.metadata.orderId;
      if (orderId) {
        // --- IDEMPOTENCY CHECK ---
        // Fetch current order status to prevent redundant updates
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .single();

        if (existingOrder?.status === 'approved') {
          console.log(`Order ${orderId} already processed. Skipping.`);
          return response.send();
        }

        // Retrieve customer email directly from Stripe session
        const customerEmail = session.customer_details?.email || session.customer_email;
        
        const { error } = await supabase
          .from('orders')
          .update({ 
            status: 'approved', 
            stripe_payment_id: session.id,
            customer_email: customerEmail
          })
          .eq('id', orderId);
        
        if (error) {
          console.error(`Error updating order ${orderId}: ${error.message}`);
          return response.status(500).send('Order update failed');
        } else {
          console.log(`Order ${orderId} marked as approved with Stripe ID.`);
          
          // --- GUEST INVITATION LOGIC (EPIC-13) ---
          // If no userId in metadata, it's a guest checkout.
          // We invite them to Clerk so they can claim their order.
          if (!session.metadata.userId && customerEmail) {
            try {
              console.log(`Sending Clerk invitation to guest: ${customerEmail}`);
              await clerk.invitations.createInvitation({
                emailAddress: customerEmail,
                redirectUrl: process.env.CLIENT_URL || 'http://localhost:5173',
                ignoreExisting: true // Don't fail if they already have an invite
              });
            } catch (clerkError) {
              console.error('Clerk Invitation Error:', clerkError);
            }
          }
        }
      }
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  response.send();
});

// Middleware for normal JSON endpoints (must come AFTER webhook)
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rybform Server Running' });
});

// Endpoint to create Stripe Checkout Session
// Rate limit this sensitive endpoint specifically
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 checkout attempts per hour per IP
  message: 'Too many checkout attempts, please try again in an hour',
});

app.post('/api/create-checkout-session', checkoutLimiter, async (req, res) => {
  try {
    // 0. Validate Request Body
    const validationResult = checkoutSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validationResult.error.errors 
      });
    }

    const { params, userEmail } = validationResult.data;
    const computedPrice = calculateCheckoutPrice(params);

    // 1. Create a pending order in Supabase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
            customer_email: userEmail || null,
            design_payload: params,
            status: 'awaiting_approval',
            is_custom_design: !!params.backplaneBezier,
          }
        ])
      .select()
      .single();

    if (orderError) throw new Error(`Supabase Order Error: ${orderError.message}`);

    // 2. Create Stripe Checkout Session
    const sessionOptions = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Custom Rybform Shelf - ${params.ribCount} Rybs`,
              description: `${params.length.value}${params.length.unit} x ${params.height.value}${params.height.unit} in ${params.material}`,
            },
            unit_amount: Math.round(computedPrice * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/#designer`,
      metadata: {
        orderId: order.id,
        userId: req.body.userId || '', // Pass through for webhook distinction
      },
    };

    // If we have an email, pass it to Stripe to pre-fill the checkout field
    if (userEmail) {
      sessionOptions.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
