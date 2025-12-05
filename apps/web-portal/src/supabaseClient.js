import { createClient } from '@supabase/supabase-js';

// CRA only exposes env vars prefixed with REACT_APP_
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
// Prefer anon key, but fall back to service role key name if that's what is configured
const supabaseKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

// Debug output to help trace configuration issues during development
// eslint-disable-next-line no-console
console.log('[Supabase DEBUG] URL present:', !!supabaseUrl);
// eslint-disable-next-line no-console
console.log('[Supabase DEBUG] Key present:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error('[Supabase] Missing REACT_APP_SUPABASE_URL or key env var. Check your .env file.');
  throw new Error('Supabase configuration is incomplete');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
