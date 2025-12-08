-- Free Grants Table
-- This table is the canonical source of truth for who has received which free grant.
-- Per FREE_TOKENS_DEVICE_DESIGN.md:
-- - One NEW_ANON_TOKENS grant per device_id (desktop device grant)
-- - One NEW_AUTH_TOKENS grant per auth_id (account creation grant)

CREATE TABLE IF NOT EXISTS free_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT,
  received_grant BOOLEAN DEFAULT TRUE,
  grant_amount INTEGER NOT NULL,
  
  -- Constraints to prevent duplicate grants
  CONSTRAINT unique_device_grant UNIQUE (device_id) WHERE device_id IS NOT NULL AND received_grant = TRUE,
  CONSTRAINT unique_auth_grant UNIQUE (auth_id) WHERE auth_id IS NOT NULL AND received_grant = TRUE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_free_grants_device_id ON free_grants(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_free_grants_auth_id ON free_grants(auth_id) WHERE auth_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_free_grants_device_auth ON free_grants(device_id, auth_id) WHERE device_id IS NOT NULL AND auth_id IS NOT NULL;

-- Enable RLS (Row Level Security) - service role bypasses this
ALTER TABLE free_grants ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access this table (backend only)
CREATE POLICY "Service role only" ON free_grants
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE free_grants IS 'Tracks free token grants to prevent abuse. One device grant per device_id, one auth grant per auth_id.';
COMMENT ON COLUMN free_grants.auth_id IS 'The auth user ID that received an auth-based grant (NEW_AUTH_TOKENS)';
COMMENT ON COLUMN free_grants.device_id IS 'The hashed device ID that received a device-based grant (NEW_ANON_TOKENS)';
COMMENT ON COLUMN free_grants.received_grant IS 'Whether this record represents a grant that has been applied';
COMMENT ON COLUMN free_grants.grant_amount IS 'How many free tokens were granted';
