-- Create Enum for Order Status
CREATE TYPE order_status AS ENUM ('awaiting_approval', 'approved', 'in_production', 'shipped');

-- Create Orders Table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text,
  customer_email text,
  status order_status DEFAULT 'awaiting_approval',
  is_custom_design boolean DEFAULT false,
  design_payload jsonb NOT NULL,
  stripe_payment_id text UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

-- Turn on Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own orders natively via PostgREST
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
USING (
  -- Requires proper mapping of Clerk tokens to Supabase auth in the client
  auth.uid()::text = clerk_user_id 
);

-- Note: Administrators bypass this using the backend Supabase Service Role Key 
-- inside an authenticated `/api/admin/*` route or through JWT role checks.
