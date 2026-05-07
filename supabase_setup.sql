-- ScribeFold AI Supabase Database Setup
-- Run this in Supabase SQL Editor to create all required tables

-- ============================================
-- 1. USERS TABLE
-- Primary table for user accounts and token management
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  auth_id TEXT UNIQUE NOT NULL,              -- Supabase auth.user.id
  tokens_used_this_month BIGINT DEFAULT 0,  -- Display only
  tokens_used_all_time BIGINT DEFAULT 0,    -- Display only
  tokens_added BIGINT DEFAULT 0,             -- Carry over between billing cycles
  tokens_monthly BIGINT DEFAULT 0,           -- Added through subscriptions
  tier_id TEXT,                              -- Subscription tier
  stripe_customer_id TEXT,                   -- Stripe customer ID
  stripe_subscription_id TEXT,               -- Stripe subscription ID
  subscription_status TEXT,                  -- Stripe subscription status
  subscription_end_date TEXT,                -- Stripe subscription end date
  next_billing_date TEXT                     -- Stripe next billing date
);

-- Indexes removed for simplicity (can add later if needed for performance)

-- ============================================
-- 2. SESSION_BUILDERS TABLE
-- Stores encrypted tokens for auto-login and magic links
-- ============================================
CREATE TABLE IF NOT EXISTS public.session_builders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  field1 TEXT NOT NULL,  -- Encrypted token
  field2 TEXT NOT NULL   -- Encrypted auth_id
);

-- Indexes removed for simplicity (can add later if needed for performance)

-- ============================================
-- 3. TOKEN_LOG TABLE (Optional - for future use)
-- Logs token transactions for auditing
-- ============================================
CREATE TABLE IF NOT EXISTS public.token_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  tokens BIGINT,
  user_id TEXT,
  note TEXT,
  tokens_monthly BIGINT DEFAULT 0,
  tokens_added BIGINT DEFAULT 0
);

-- Indexes removed for simplicity (can add later if needed for performance)

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_builders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_log ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Allow service role (backend) full access
CREATE POLICY "Service role can manage users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Session_builders table policies
-- Allow service role full access
CREATE POLICY "Service role can manage session_builders"
  ON public.session_builders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Token_log table policies
-- Allow service role full access
CREATE POLICY "Service role can manage token_log"
  ON public.token_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS (OPTIONAL - Remove if not needed)
-- ============================================

-- This trigger automatically creates a user row in public.users when a new auth user signs up
-- If your app was working before without this, you may have manually created user rows or had this set up

-- Function to get or create user row when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id)
  VALUES (NEW.id)
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user row on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify tables were created correctly
-- ============================================

-- Check tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'session_builders', 'token_log')
ORDER BY table_name;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
