# Rybform Stripe Integration

The Stripe payment integration uses a Node.js Express backend to securely create Checkout Sessions and handle payment webhooks.

## 1. Get Your Stripe Test Keys
1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys).
2. Ensure **Test mode** is toggled ON (top right corner).
3. Copy your **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).

## 2. Configure Environment Variables
1. **Frontend**: Open `d:\dev\paradecor\.env.local` and add:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   ```
2. **Backend**: Create a new file `d:\dev\paradecor\server\.env` and add:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   CLIENT_URL=http://localhost:5173
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   PORT=3001
   ```

## 3. Run the Backend Server
Open a new terminal, navigate to the `server` folder, and start it:
```bash
cd server
npm run dev
```
You should see `Server running on port 3001`.

## 4. Test Webhooks Locally
Stripe needs a way to send payment success events to your local computer. Use the Stripe CLI:
1. [Install the Stripe CLI](https://docs.stripe.com/stripe-cli)
2. Run this command to forward events to your local server:
   ```bash
   stripe listen --forward-to localhost:3001/api/webhook
   ```
3. The CLI will print a webhook secret (`whsec_...`). Copy this into your `server/.env` file as `STRIPE_WEBHOOK_SECRET=...` and restart the Express server.

## 5. Test the Full Flow
1. Ensure both your Vite React app (`npm run dev`) and your Express server (`npm run dev` in `/server`) are running.
2. Sign in to Rybform as an admin.
3. Design a shelf and click **Export & Order**.
4. You should be redirected to Stripe's test checkout page.
5. Enter a test credit card (e.g., `4242 4242 4242 4242` with any future expiry).
6. Upon success, look at your Express server terminal — you should see `Payment successful for session ...!` printed by the webhook handler!
