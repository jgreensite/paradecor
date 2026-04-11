-- Authoritative orders table for the current runtime contract.
-- Keep this file in sync with server/server.js and src/core/ports/IDatabaseService.ts.
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT,
  design_payload JSONB NOT NULL,
  is_custom_design BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('awaiting_approval', 'approved', 'in_production', 'shipped')),
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_id
  ON orders (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON orders (customer_email);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders (status, created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
USING (auth.jwt() ->> 'email' = customer_email);

DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders"
ON orders FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');
