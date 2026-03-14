import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
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
        const { error } = await supabase
          .from('orders')
          .update({ status: 'paid', stripe_session_id: session.id })
          .eq('id', orderId);
        
        if (error) {
          console.error(`Error updating order ${orderId}: ${error.message}`);
        } else {
          console.log(`Order ${orderId} marked as paid.`);
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
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { params, price, userEmail } = req.body;

    // 1. Create a pending order in Supabase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_email: userEmail,
          params: params,
          total_price: price,
          status: 'pending',
          currency: 'usd'
        }
      ])
      .select()
      .single();

    if (orderError) throw new Error(`Supabase Order Error: ${orderError.message}`);

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Custom Rybform Shelf - ${params.ribCount} Rybs`,
              description: `${params.length.value}${params.length.unit} x ${params.height.value}${params.height.unit} in ${params.material}`,
            },
            unit_amount: Math.round(price * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/#designer`,
      metadata: {
        orderId: order.id,
      },
    });

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
