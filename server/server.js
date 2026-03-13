import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
// --- Webhook Endpoint ---
// Stripe requires the raw body to verify the signature
app.post('/api/webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`Payment successful for session ${session.id}!`);
      console.log('Order metadata:', session.metadata);
      // Here we would eventually save the order to Supabase (EPIC-14)
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  response.send();
});

// Middleware for normal JSON endpoints (must come AFTER webhook)
app.use(express.json());

// Endpoint to create Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { params, price } = req.body;

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
        // Stripe metadata max is 500 chars per key. If params is huge, this might fail.
        // For a full order system, we should save the order to a DB *FIRST* with status 'pending',
        // and just pass the orderId in the metadata.
        // For now, we will store a simplified stringified version of core params.
        shelfParams: JSON.stringify({
          ribCount: params.ribCount,
          material: params.material,
          width: params.length.value,
          height: params.height.value
        }),
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
