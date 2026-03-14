-- Create orders table for Rybform
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  params JSONB NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'fulfilled', 'cancelled')),
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies (Example: Admins can see everything, users can see their own)
-- Note: Requires Supabase Auth integration for 'auth.email()' to work
CREATE POLICY "Users can view their own orders" 
ON orders FOR SELECT 
USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Admins can view all orders" 
ON orders FOR ALL 
USING (auth.jwt() ->> 'role' = 'admin');
