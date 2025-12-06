require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { encoding_for_model } = require('tiktoken');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Token and messaging configuration
const NEW_ANON_TOKENS = 15000;           // Tokens for anon users (default + bonus for new anon)
const NEW_AUTH_TOKENS = 25000;           // Bonus tokens for brand new auth user (used on upgrade)
const NEW_MONTHLY_TOKENS = 15000;        // Monthly refill amount for paid tiers

// Auth account status messages (keep here so they stay in sync with token constants)
const AUTH_CREATE_NEW_USER_MESSAGE =
  `Created new auth account and user record; added ${NEW_AUTH_TOKENS.toLocaleString()} bonus tokens.`;
const AUTH_LINK_EXISTING_ANON_MESSAGE =
  `Created new auth account and linked to existing anon user; added ${NEW_AUTH_TOKENS.toLocaleString()} bonus tokens.`;
const AUTH_REPEAT_ACCOUNT_MESSAGE =
  'Created repeat auth account; added 0 bonus tokens because this anon ID already has an account.';

const OUT_OF_TOKENS_MESSAGE_ANON = 'All tokens have been used! Click the button below or check File => settings => account to create an account for ' + NEW_AUTH_TOKENS + " tokens now, " + NEW_MONTHLY_TOKENS + " per month, and to view more options.";
const OUT_OF_TOKENS_MESSAGE_AUTH = 'All tokens have been used! Click the button below or check File => settings => account to manage your account to see options for more tokens.';
// Subscription tiers configuration
// - tier_id: Stable numeric ID (1-4) stored in DB, won't change if titles change
// - The object key (light/basic/full/heavy) is the internal ID used in code
// - title: Display name shown to users (can change for marketing)
const subscription_tiers = {
  "light": {
    "tier_id": 1,
    "monthly_allowance": 1000000,
    "title": "Light",
    "description": "Good for occasional writing and small projects.",
    "monthly_price": 8.5,
    "stripe_price_id": process.env.STRIPE_PRICE_ID_LIGHT || 'price_1SaNZPQVYKqBO1rjEhgeyuwq',
    "stripe_payment_link": process.env.STRIPE_PAYMENT_LINK_LIGHT || 'https://buy.stripe.com/test_5kQfZjbhLdNlaI6bDdaIM02'
  },
  "basic": {
    "tier_id": 2,
    "monthly_allowance": 2500000,
    "title": "Basic",
    "description": "Good for regular use and active editing sessions.",
    "monthly_price": 14.5,
    "stripe_price_id": process.env.STRIPE_PRICE_ID_BASIC || 'price_1SaNZPQVYKqBO1rjnt5LBAKX',
    "stripe_payment_link": process.env.STRIPE_PAYMENT_LINK_BASIC || 'https://buy.stripe.com/test_14A6oJ71v7oXdUi22DaIM03'
  },
  "full": {
    "tier_id": 3,
    "monthly_allowance": 8500000,
    "title": "Standard",
    "description": "Great for creating stories and books.",
    "monthly_price": 28.5,
    "stripe_price_id": process.env.STRIPE_PRICE_ID_FULL || 'price_1SaNZPQVYKqBO1rjrKaqR1md',
    "stripe_payment_link": process.env.STRIPE_PAYMENT_LINK_FULL || 'https://buy.stripe.com/test_cNieVf2Lf24D2bAbDdaIM04'
  },
  "heavy": {
    "tier_id": 4,
    "monthly_allowance": 85000000,
    "title": "Heavy",
    "description": "Dare you to use them all.",
    "monthly_price": 89.5,
    "stripe_price_id": process.env.STRIPE_PRICE_ID_HEAVY || 'price_1SaNZPQVYKqBO1rjMKLFPpsk',
    "stripe_payment_link": process.env.STRIPE_PAYMENT_LINK_HEAVY || 'https://buy.stripe.com/test_7sYfZj2Lf7oX03s9v5aIM05'
  }
};

// Helper to get tier by numeric ID
function getTierById(tierId) {
  for (const [key, tier] of Object.entries(subscription_tiers)) {
    if (tier.tier_id === tierId) return { key, ...tier };
  }
  return null;
}

// Helper to get tier by internal key
function getTierByKey(key) {
  if (subscription_tiers[key]) {
    return { key, ...subscription_tiers[key] };
  }
  return null;
}

// Helper to get tier_id from Stripe price ID
function getTierIdFromPriceId(priceId) {
  for (const [key, tier] of Object.entries(subscription_tiers)) {
    if (tier.stripe_price_id === priceId) {
      return tier.tier_id;
    }
  }
  return null;
}

// Helper to get the effective current period start/end timestamps (in seconds) from a Stripe subscription
// Many Stripe responses put period info on items.data[0] rather than the top-level subscription.
function getSubscriptionCurrentPeriodStartTimestamp(subscription) {
  if (!subscription) return null;

  // Preferred: first subscription item's current_period_start
  const item = subscription.items?.data?.[0];
  if (item && item.current_period_start) {
    return item.current_period_start;
  }

  // Fallback: top-level current_period_start
  if (subscription.current_period_start) {
    return subscription.current_period_start;
  }

  // Final fallback: billing_cycle_anchor (start of cycle) if present
  if (subscription.billing_cycle_anchor) {
    return subscription.billing_cycle_anchor;
  }

  return null;
}

function getSubscriptionCurrentPeriodEndTimestamp(subscription) {
  if (!subscription) return null;

  // Preferred: first subscription item's current_period_end
  const item = subscription.items?.data?.[0];
  if (item && item.current_period_end) {
    return item.current_period_end;
  }

  // Fallback: top-level current_period_end when present
  if (subscription.current_period_end) {
    return subscription.current_period_end;
  }

  // Final fallback: billing_cycle_anchor (acts as period boundary) if present
  if (subscription.billing_cycle_anchor) {
    return subscription.billing_cycle_anchor;
  }

  return null;
}

// Initialize Supabase client
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log('✓ Supabase client initialized');
} else {
  console.warn('⚠ Supabase not configured - user tracking disabled');
}

// Initialize Stripe client
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('✓ Stripe client initialized');
} else {
  console.warn('⚠ Stripe not configured - payment processing disabled');
}

// Middleware
app.use(cors());

// Stripe webhook needs raw body, so we handle it before JSON parsing
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// JSON parsing for all other routes
app.use(express.json({ limit: '50mb' }));

// Initialize tiktoken encoder for DeepSeek (uses GPT-3.5 tokenizer as approximation)
let encoder;
let usingFallbackTokenizer = false;
try {
  encoder = encoding_for_model('gpt-3.5-turbo');
  console.log('✓ Tiktoken encoder initialized successfully');
} catch (error) {
  console.warn('⚠ Failed to initialize tiktoken encoder, using character-based fallback:', error.message);
  usingFallbackTokenizer = true;
}

/**
 * Character-based token counter fallback
 * Approximates tokens by counting characters divided by 4 (average chars per token)
 * @param {string} text - Text to count tokens for
 * @returns {number} - Approximate number of tokens
 */
function countTokensFallback(text) {
  if (!text) return 0;
  // Average of ~4 characters per token for English text
  // This is a rough approximation but works reasonably well
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens in a string using tiktoken or fallback
 * @param {string} text - Text to count tokens for
 * @returns {number} - Number of tokens
 */
function countTokens(text) {
  if (!text) return 0;
  
  if (encoder && !usingFallbackTokenizer) {
    try {
      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (error) {
      console.error('Error counting tokens with tiktoken, falling back to character-based:', error);
      usingFallbackTokenizer = true;
      return countTokensFallback(text);
    }
  }
  
  return countTokensFallback(text);
}

/**
 * Count tokens in messages array
 * @param {Array} messages - Array of message objects with role and content
 * @returns {number} - Total number of tokens
 */
function countMessagesTokens(messages) {
  if (!messages || !Array.isArray(messages)) return 0;
  
  let totalTokens = 0;
  messages.forEach(message => {
    // Count tokens for role and content
    totalTokens += countTokens(message.role || '');
    totalTokens += countTokens(message.content || '');
    // Add overhead tokens for message formatting (approximate)
    totalTokens += 4; // <|start|>role<|message|>content<|end|>
  });
  
  return totalTokens;
}

/**
 * Get or create user in database
 * @param {string} anonId - Anonymous ID
 * @param {string} authId - Authenticated user ID (optional)
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<Object>} - User object
 */
async function getOrCreateUser(anonId, authId, ipAddress) {
  if (!supabase) return null;

  try {
    // First try to find user by auth_id if provided
    if (authId) {
      // NOTE: We assume auth_id is effectively unique (at most one row per auth user).
      // If this ever returns multiple rows, we may need to revisit user schema/merging.
      const { data: authUsers, error: authError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId);

      if (authError) {
        console.error('❌ Error querying users by auth_id:', authError);
      } else if (authUsers && authUsers.length > 0) {
        // If multiple rows exist for this auth_id, pick the first deterministically
        if (authUsers.length > 1) {
          console.warn('⚠ Multiple user rows found for auth_id, using first row. Count =', authUsers.length);
        }

        const authUser = authUsers[0];
        // console.log('  → Found existing user by auth_id');

        // Update anon_id if needed
        if (anonId && authUser.anon_id !== anonId) {
          await supabase
            .from('users')
            .update({ anon_id: anonId })
            .eq('id', authUser.id);
        }

        return authUser;
      }
    }

    // Try to find user(s) by anon_id (do NOT use .single() so multiple rows don't throw).
    // NOTE: Data model allows multiple rows with the same anon_id (historical/edge cases),
    // so we intentionally handle an array here.
    const { data: anonUsers, error: anonError } = await supabase
      .from('users')
      .select('*')
      .eq('anon_id', anonId);

    if (anonError) {
      console.error('❌ Error querying users by anon_id:', anonError);
    } else if (anonUsers && anonUsers.length > 0) {
      if (anonUsers.length > 1) {
        console.warn('⚠ Multiple user rows found for anon_id, using first row. Count =', anonUsers.length);
      }

      const anonUser = anonUsers[0];
      // console.log('  → Found existing user by anon_id');
      
      // If auth_id provided, link it to existing anon account when not already linked
      if (authId && !anonUser.auth_id) {
        // console.log('  → Linking auth_id to anonymous account');
        const { data: updated } = await supabase
          .from('users')
          .update({ 
            auth_id: authId
            // Keep tokens_monthly, tokens_added and tokens_used as-is
            // Monthly allowance is set via Stripe webhook when subscription is created
          })
          .eq('id', anonUser.id)
          .select()
          .single();
        
        return updated || anonUser;
      }
      
      // User exists, no further update needed here
      // console.log('  → User already exists, no update needed');
      
      return anonUser;
    }

    // Create new user (no existing rows for this anon_id/auth_id combination)
    // console.log('  → Creating new user in database');
    // New users: anon gets 0 monthly + NEW_ANON_TOKENS bonus, auth gets 0 monthly + NEW_AUTH_TOKENS (will be set on upgrade)
    const isNewAnon = !authId;
    const initialTokensAdded = isNewAnon ? NEW_ANON_TOKENS : NEW_AUTH_TOKENS;
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        anon_id: anonId,
        auth_id: authId || null,
        tokens_monthly: 0,           // No monthly allowance initially (set via Stripe webhook)
        tokens_used: 0,              // No tokens used yet
        tokens_added: initialTokensAdded,  // Bonus for anon vs auth defined by constants
        tokens_used_all_time: 0      // No lifetime usage yet
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return null;
    }

    const totalTokens = initialTokensAdded;
    // console.log('  → New user created with', totalTokens, 'tokens (bonus)');

    // Best-effort log of initial bonus tokens
    try {
      const note = isNewAnon ? 'New anon user initial tokens' : 'New auth user initial tokens';
      await logTokenChange(newUser.id, initialTokensAdded, note);
    } catch (logError) {
      console.error('[getOrCreateUser] Failed to log initial token grant:', logError);
    }
    return newUser;
  } catch (error) {
    console.error('❌ Error in getOrCreateUser:', error);
    return null;
  }
}

/**
 * Calculate available tokens for a user
 * NEW FORMULA: tokens_monthly + tokens_added
 * - tokens_monthly: Current monthly allowance balance (decreases as used)
 * - tokens_added: Long-lived carry-over bucket (bonuses, top-ups)
 * All fields are coerced to numbers to avoid string concatenation issues
 * when Supabase returns BIGINT / int8 as strings.
 * @param {Object} user - User object with token fields
 * @returns {number} - Available tokens
 */
function calculateAvailableTokens(user) {
  const tokensMonthly = Number(user.tokens_monthly) || 0;
  const tokensAdded = Number(user.tokens_added) || 0;

  const available = tokensMonthly + tokensAdded;
  return Math.max(0, available); // Never negative
}

const DEFAULT_USER_TEMPLATE = {
  anon_id: null,
  auth_id: null,
  tokens_monthly: 0,
  tokens_used: 0,
  tokens_added: NEW_ANON_TOKENS,
  tokens_used_all_time: 0,
};

/**
 * Update user token usage
 * NEW TOKEN TRACKING SYSTEM:
 * - tokens_monthly: Current monthly allowance BALANCE (decreases as used)
 * - tokens_used: Tokens used in current billing period (counter, resets monthly)
 * - tokens_added: Long-lived bonus tokens (never reset by month)
 * - tokens_used_all_time: Lifetime usage counter (never resets)
 * 
 * DEDUCTION ORDER (per TOKEN_TRACKING.md Section 4.2):
 * 1. Use monthly allowance first: tokens_monthly decreases
 * 2. Then use from added: tokens_added decreases
 * 3. tokens_used and tokens_used_all_time increment as counters
 * 4. Allow request if totalAvailable > 0 (even if N > totalAvailable)
 * 5. Never set balances below 0
 * 
 * @param {string} userId - User database ID
 * @param {number} tokensToUse - Number of tokens to use (N)
 * @param {string} [note] - Optional note for token_log (e.g., 'API usage (DeepSeek)')
 * @returns {Promise<Object>} - { success, availableTokens, error }
 */
async function updateUserTokens(userId, tokensToUse, note = null) {
  if (!supabase || !userId) return { success: false, error: 'No database connection' };

  try {
    const N = tokensToUse;
    
    // Get current user data
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('tokens_monthly, tokens_used, tokens_added, tokens_used_all_time')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('[updateUserTokens] Error fetching user:', fetchError);
      return { success: false, error: fetchError.message };
    }
    
    // Coerce all token fields to numbers in case Supabase returns strings for int8
    const monthly = Math.max(Number(user.tokens_monthly) || 0, 0);
    const added = Math.max(Number(user.tokens_added) || 0, 0);
    const tokensUsed = Number(user.tokens_used) || 0;
    const tokensUsedAllTime = Number(user.tokens_used_all_time) || 0;
    
    // Calculate total available BEFORE this usage
    const totalAvailable = monthly + added;
    
    // ELIGIBILITY CHECK (Section 4.1)
    // Block if totalAvailable <= 0, allow even if N > totalAvailable
    if (totalAvailable <= 0) {
      console.error('[updateUserTokens] No tokens available');
      return { 
        success: false, 
        availableTokens: 0,
        error: 'All tokens used' 
      };
    }
    
    // DEDUCTION ORDER (Section 4.2)
    // Step 1: Use monthly allowance first
    const useFromMonthly = Math.min(N, monthly);
    const remaining = N - useFromMonthly;
    let newTokensMonthly = monthly - useFromMonthly;
    
    // Step 2: Then use from added
    const useFromAdded = Math.min(remaining, added);
    let newTokensAdded = added - useFromAdded;
    
    // Step 3: No negative balances (safety)
    newTokensMonthly = Math.max(0, newTokensMonthly);
    newTokensAdded = Math.max(0, newTokensAdded);
    
    // Step 4: Usage counters (always increment by N)
    const newTokensUsed = tokensUsed + N;
    const newTokensUsedAllTime = tokensUsedAllTime + N;
    
    // Update database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        tokens_monthly: newTokensMonthly,
        tokens_used: newTokensUsed,
        tokens_added: newTokensAdded,
        tokens_used_all_time: newTokensUsedAllTime
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('[updateUserTokens] Error updating tokens:', updateError);
      return { success: false, error: updateError.message };
    }
    
    // Calculate new available tokens
    const newAvailable = newTokensMonthly + newTokensAdded;
    
    console.log(`[updateUserTokens] Deducted ${N} tokens: monthly ${monthly}->${newTokensMonthly}, added ${added}->${newTokensAdded}, available ${totalAvailable}->${newAvailable}`);

    // Best-effort audit log to token_log (negative for deductions)
    try {
      const delta = -Math.abs(N);
      const logNote = note || 'API usage';
      await logTokenChange(userId, delta, logNote);
    } catch (logError) {
      console.error('[updateUserTokens] Failed to log token change:', logError);
      // Do not fail the main operation if logging fails
    }

    return {
      success: true,
      availableTokens: newAvailable
    };
  } catch (error) {
    console.error('[updateUserTokens] Exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log API request to database
 * @param {Object} requestData - Request data to log
 */
async function logApiRequest(requestData) {
  if (!supabase) return;

  try {
    await supabase
      .from('api_requests')
      .insert({
        user_id: requestData.userId,
        anon_id: requestData.anonId,
        auth_id: requestData.authId || null,
        ip_address: requestData.ipAddress,
        endpoint: requestData.endpoint,
        tokens_input: requestData.tokensInput,
        tokens_output: requestData.tokensOutput,
        tokens_total: requestData.tokensTotal,
        model: requestData.model,
        response_time: requestData.responseTime,
        success: requestData.success,
        error_message: requestData.errorMessage || null
      });
  } catch (error) {
    console.error('Error logging API request:', error);
  }
}

/**
 * Log a token change to token_log (best-effort)
 * @param {string} userId - User ID from users table
 * @param {number} tokensDelta - Signed delta (+ for additions, - for deductions)
 * @param {string} note - Human-readable description of the event
 */
async function logTokenChange(userId, tokensDelta, note) {
  if (!supabase) return;
  if (!userId) return;
  if (!tokensDelta || Number(tokensDelta) === 0) return;

  try {
    await supabase
      .from('token_log')
      .insert({
        user_id: String(userId),
        tokens: Number(tokensDelta),
        note: note || null,
      });
  } catch (error) {
    console.error('[logTokenChange] Failed to insert token_log row:', error);
  }
}

/**
 * Call DeepSeek API
 * @param {Array} messages - Array of message objects
 * @param {Object} options - Additional options (temperature, etc.)
 * @returns {Promise<Object>} - API response with token counts
 */
async function callDeepSeekAPI(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured in environment variables');
  }

  const requestBody = {
    model: options.model || 'deepseek-chat',
    messages: messages,
    stream: false,
    temperature: options.temperature || 0.7
  };

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

app.get('/', (req, res) => {
  res.json({"message": "server running."})
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
    supabaseConfigured: !!supabase,
    tokenizer: usingFallbackTokenizer ? 'character-based (fallback)' : 'tiktoken'
  });
});

// Subscription tiers endpoint
app.get('/api/subscription-tiers', (req, res) => {
  res.json(subscription_tiers);
});
// Hellooo
// Proxy endpoint to fetch GitHub releases for private repo (used by web-portal downloads page)
app.get('/api/releases', async (req, res) => {
  console.log('=== [GET /api/releases] Incoming request ===');
  console.log('[GET /api/releases] Path:', req.path, 'OriginalUrl:', req.originalUrl);

  try {
    const owner = process.env.GITHUB_REPO_OWNER || 'AbeApple';
    const repo = process.env.GITHUB_REPO_NAME || 'scribefold-ai-monorepo';
    const token = process.env.GITHUB_DOWNLOAD_TOKEN;

    console.log('[GET /api/releases] Env check:', {
      owner,
      repo,
      hasToken: !!token,
    });

    if (!token) {
      console.error('[GET /api/releases] Missing GITHUB_DOWNLOAD_TOKEN');
      return res.status(500).json({ error: 'GitHub download token not configured' });
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
    console.log('[GET /api/releases] Fetching from GitHub URL:', url);

    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'scribefold-api-server'
      }
    });

    console.log('[GET /api/releases] GitHub response status:', ghRes.status);

    if (!ghRes.ok) {
      const text = await ghRes.text().catch(() => '');
      console.error('[GET /api/releases] GitHub error body:', text);
      return res.status(ghRes.status).json({ error: 'GitHub API error', status: ghRes.status });
    }

    const data = await ghRes.json();
    console.log('[GET /api/releases] Successfully fetched releases. Count:', Array.isArray(data) ? data.length : 'n/a');
    return res.json(data);
  } catch (err) {
    console.error('[GET /api/releases] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Fetch token_log entries for a user.
 * POST /api/user/token-log
 * Body: { anonId, authId, limit?, offset? }
 */
app.post('/api/user/token-log', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { anonId, authId, limit, offset } = req.body || {};

    if (!anonId && !authId) {
      return res.status(400).json({ error: 'anonId or authId is required' });
    }

    const pageSize = Math.max(1, Math.min(Number(limit) || 50, 200));
    const pageOffset = Math.max(0, Number(offset) || 0);

    // Find user by authId (preferred) or anonId
    let userQuery = supabase.from('users').select('id').limit(1);

    if (authId) {
      userQuery = userQuery.eq('auth_id', authId);
    } else {
      userQuery = userQuery.eq('anon_id', anonId);
    }

    const { data: users, error: userError } = await userQuery;

    if (userError) {
      console.error('[token-log] Error fetching user:', userError);
      return res.status(500).json({ error: userError.message });
    }

    if (!users || users.length === 0) {
      return res.json({ logs: [], hasMore: false });
    }

    const user = users[0];

    // Fetch token_log rows
    const { data: logs, error: logError } = await supabase
      .from('token_log')
      .select('*')
      .eq('user_id', String(user.id))
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageSize - 1);

    if (logError) {
      console.error('[token-log] Error fetching logs:', logError);
      return res.status(500).json({ error: logError.message });
    }

    const hasMore = logs && logs.length === pageSize;

    return res.json({
      logs: logs || [],
      hasMore,
    });
  } catch (error) {
    console.error('[token-log] Unexpected error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login to existing auth account and link to anon user without bonus tokens
app.post('/api/users/login', async (req, res) => {
  try {
    const { anonId, email, password } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!anonId || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'anonId, email, and password are required'
      });
    }

    // console.log('=== Login Account Request ===');
    // console.log('anonId:', anonId);
    // console.log('email:', email);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('❌ Failed to login auth user:', authError);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const authUser = authData.user;
    const authId = authUser.id;

    // Find existing users with this anon_id
    const { data: existingUsers, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('anon_id', anonId);

    if (existingError) {
      console.error('❌ Failed to fetch users by anon_id (login):', existingError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch existing users',
        details: existingError.message
      });
    }

    let message = '';
    let userRow = null;

    if (!existingUsers || existingUsers.length === 0) {
      // No existing anon row: create a user row with no bonus tokens
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({
          anon_id: anonId,
          auth_id: authId,
          tokens_monthly: 0,
          tokens_used: 0,
          tokens_added: 0,
          tokens_used_all_time: 0
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to insert user row on login:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user record on login',
          details: insertError.message
        });
      }

      userRow = inserted;
      message = 'Logged in and created user record; no bonus tokens awarded on login.';
    } else if (existingUsers.length === 1 && !existingUsers[0].auth_id) {
      // Single anon row without auth_id: link auth_id, no token changes
      const row = existingUsers[0];

      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
          auth_id: authId
        })
        .eq('id', row.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update user row on login:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update user record on login',
          details: updateError.message
        });
      }

      userRow = updated;
      message = 'Logged in and linked to existing anon user; no bonus tokens awarded on login.';
    } else {
      // Multiple rows or at least one already has auth_id, create a new row with no bonus tokens
      const { data: repeatUser, error: repeatError } = await supabase
        .from('users')
        .insert({
          anon_id: anonId,
          auth_id: authId,
          email,
          password,
          tokens_monthly: 0,
          tokens_used: 0,
          tokens_added: 0,
          tokens_used_all_time: 0
        })
        .select()
        .single();

      if (repeatError) {
        console.error('❌ Failed to insert repeat user row on login:', repeatError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create repeat user record on login',
          details: repeatError.message
        });
      }

      userRow = repeatUser;
      message = 'Logged in with existing account; no bonus tokens awarded for repeat accounts.';
    }

    // console.log('✓ Login-account completed:', message);

    return res.json({
      success: true,
      message,
      authUser,
      user: userRow
    });
  } catch (error) {
    console.error('Error in /api/users/login:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
      details: error.message
    });
  }
});

// Create auth account and link to anon user with token bonus logic
app.post('/api/users/create-account', async (req, res) => {
  try {
    const { anonId, name, email, password } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!anonId || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'anonId, email, and password are required'
      });
    }

    // console.log('=== Create Account Request ===');
    // console.log('anonId:', anonId);
    // console.log('email:', email);

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { name } : undefined
    });

    if (authError) {
      console.error('❌ Failed to create auth user:', authError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create auth user',
        details: authError.message
      });
    }

    const authUser = authData.user;
    const authId = authUser.id;
    const BONUS_TOKENS = NEW_AUTH_TOKENS;

    // Find all user rows with this anon_id
    const { data: existingUsers, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('anon_id', anonId);

    if (existingError) {
      console.error('❌ Failed to fetch users by anon_id:', existingError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch existing users',
        details: existingError.message
      });
    }

    let message = '';
    let userRow = null;

    if (!existingUsers || existingUsers.length === 0) {
      // No existing anon row: treat as new account with bonus
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({
          anon_id: anonId,
          auth_id: authId,
          email,
          password,
          tokens_monthly: 0,
          tokens_used: 0,
          tokens_added: BONUS_TOKENS,
          tokens_used_all_time: 0
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to insert new user row:', insertError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user record',
          details: insertError.message
        });
      }

      userRow = inserted;
      message = AUTH_CREATE_NEW_USER_MESSAGE;

      // Log bonus tokens for brand new auth user
      try {
        await logTokenChange(userRow.id, BONUS_TOKENS, 'Auth create-account bonus (new user)');
      } catch (logError) {
        console.error('[create-account] Failed to log auth create bonus:', logError);
      }
    } else if (existingUsers.length === 1 && !existingUsers[0].auth_id) {
      // Single anon row without auth_id: link and add bonus tokens
      const row = existingUsers[0];
      const currentAdded = Number(row.tokens_added) || 0;
      const newTokensAdded = currentAdded + BONUS_TOKENS;

      const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
          auth_id: authId,
          email,
          password,
          tokens_added: newTokensAdded
        })
        .eq('id', row.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update existing user row:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update user record',
          details: updateError.message
        });
      }

      userRow = updated;
      message = AUTH_LINK_EXISTING_ANON_MESSAGE;

      // Log auth upgrade bonus when linking anon -> auth
      try {
        await logTokenChange(userRow.id, BONUS_TOKENS, 'Auth upgrade bonus (link anon → auth)');
      } catch (logError) {
        console.error('[create-account] Failed to log auth upgrade bonus:', logError);
      }
    } else {
      // Multiple rows with this anon_id or at least one already has auth_id
      // Treat as repeat account: create a fresh row with 0 new tokens
      const { data: repeatUser, error: repeatError } = await supabase
        .from('users')
        .insert({
          anon_id: anonId,
          auth_id: authId,
          tokens_monthly: 0,
          tokens_used: 0,
          tokens_added: 0,
          tokens_used_all_time: 0
        })
        .select()
        .single();

      if (repeatError) {
        console.error('❌ Failed to insert repeat user row:', repeatError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create repeat user record',
          details: repeatError.message
        });
      }

      userRow = repeatUser;
      message = AUTH_REPEAT_ACCOUNT_MESSAGE;
    }

    // console.log('✓ Create-account completed:', message);

    return res.json({
      success: true,
      message,
      authUser,
      user: userRow
    });
  } catch (error) {
    console.error('Error in /api/users/create-account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
      details: error.message
    });
  }
});

// DeepSeek query endpoint
app.post('/api/deepseek/query', async (req, res) => {
  try {
    const { messages, userId, authId, temperature, model } = req.body;

    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array is required and must not be empty' 
      });
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({ 
          error: 'Invalid message format: each message must have role and content' 
        });
      }
    }

    // Get user's IP address
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    // Get or create user in database
    const user = await getOrCreateUser(userId, authId, ipAddress);
    const isAnonymous = !authId;

    // Count input tokens
    const inputTokens = countMessagesTokens(messages);
    
    // console.log('=== DeepSeek API Request ===');
    // console.log('User ID:', userId || 'anonymous');
    // console.log('Auth ID:', authId || 'none');
    // console.log('Is Anonymous:', isAnonymous);
    // console.log('IP Address:', ipAddress);
    // console.log('Model:', model || 'deepseek-chat');
    // console.log('Temperature:', temperature || 0.7);
    // console.log('Messages:', messages.length);
    // console.log('Input tokens:', inputTokens);
    // console.log('Timestamp:', new Date().toISOString());

    // If we have user data and they have no or insufficient tokens for this
    // request, short-circuit and return a friendly message without calling
    // the DeepSeek API. This makes the out-of-tokens response nearly instant.
    if (user) {
      const availableBefore = calculateAvailableTokens(user);

      if (availableBefore <= 0) {
        // console.log('=== DeepSeek Short-Circuit: Not enough tokens ===');
        // console.log('Available tokens before request:', availableBefore);

        const isAnonUser = !authId;
        let outOfTokensMessage;
        if (isAnonUser) {
          outOfTokensMessage = OUT_OF_TOKENS_MESSAGE_ANON;
        } else {
          outOfTokensMessage = OUT_OF_TOKENS_MESSAGE_AUTH;
        }

        const payload = {
          message: outOfTokensMessage,
          changes: [],
          button: 'account-settings'
        };

        const now = new Date().toISOString();

        return res.json({
          success: true,
          response: JSON.stringify(payload),
          message: null,
          tokenUsage: {
            input: inputTokens,
            output: 0,
            total: inputTokens,
            tokensMonthly: user.tokens_monthly || 0,
            tokensUsed: user.tokens_used || 0,
            tokensAdded: user.tokens_added || 0,
            tokensUsedAllTime: user.tokens_used_all_time || 0,
            availableTokens: Math.max(0, availableBefore),
            apiReported: null
          },
          metadata: {
            model: model || 'deepseek-chat',
            finishReason: 'out_of_tokens_short_circuit',
            responseTime: 0,
            timestamp: now,
            userId: userId || null,
            isAnonymous: isAnonUser
          }
        });
      }
    }

    // Call DeepSeek API
    const startTime = Date.now();
    const apiResponse = await callDeepSeekAPI(messages, { temperature, model });
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Extract response content
    const responseContent = apiResponse.choices?.[0]?.message?.content || '';
    
    // Count response tokens
    const responseTokens = countTokens(responseContent);
    const totalTokens = inputTokens + responseTokens;

    // Log token usage
    // console.log('=== DeepSeek API Response ===');
    // console.log('Response tokens:', responseTokens);
    // console.log('Total tokens:', totalTokens);
    // console.log('Response time:', responseTime, 'ms');
    // console.log('Finish reason:', apiResponse.choices?.[0]?.finish_reason);
    
    // Log usage from API if available
    // if (apiResponse.usage) {
    //   console.log('API reported usage:', {
    //     prompt_tokens: apiResponse.usage.prompt_tokens,
    //     completion_tokens: apiResponse.usage.completion_tokens,
    //     total_tokens: apiResponse.usage.total_tokens
    //   });
    // }
    // console.log('============================\n');

    // Update user token usage in database
    let tokenUpdateResult = { success: true, availableTokens: 0 };
    let userTokenData = null;
    
    if (user) {
      tokenUpdateResult = await updateUserTokens(user.id, totalTokens, 'API usage (DeepSeek)');
      
      if (!tokenUpdateResult.success) {
        console.error('❌ All tokens used:', tokenUpdateResult.error);
        
        // Log failed request
        await logApiRequest({
          userId: user.id,
          anonId: userId,
          authId: authId || null,
          ipAddress: ipAddress,
          endpoint: '/api/deepseek/query',
          tokensInput: inputTokens,
          tokensOutput: responseTokens,
          tokensTotal: totalTokens,
          model: apiResponse.model || model || 'deepseek-chat',
          responseTime: responseTime,
          success: false,
          errorMessage: tokenUpdateResult.error
        });
        
        // Return error response
        return res.status(429).json({
          success: false,
          error: 'All tokens used',
          message: 'You have used all your available tokens. Upgrade your account for more tokens.',
          availableTokens: 0
        });
      }
      
      console.log('✓ Updated user token count in database');
      console.log('✓ Available tokens after deduction:', tokenUpdateResult.availableTokens);
      
      // Fetch complete user token data for response
      const { data: currentUser } = await supabase
        .from('users')
        .select('tokens_monthly, tokens_used, tokens_added, tokens_used_all_time')
        .eq('id', user.id)
        .single();
      
      userTokenData = currentUser;
      console.log('✓ User token state:');
      console.log('  - tokens_monthly:', currentUser?.tokens_monthly);
      console.log('  - tokens_used:', currentUser?.tokens_used);
      console.log('  - tokens_added:', currentUser?.tokens_added);
      console.log('  - tokens_used_all_time:', currentUser?.tokens_used_all_time);
      console.log('  - available:', tokenUpdateResult.availableTokens);
    }

    // Log successful API request to database
    await logApiRequest({
      userId: user?.id || null,
      anonId: userId,
      authId: authId || null,
      ipAddress: ipAddress,
      endpoint: '/api/deepseek/query',
      tokensInput: inputTokens,
      tokensOutput: responseTokens,
      tokensTotal: totalTokens,
      model: apiResponse.model || model || 'deepseek-chat',
      responseTime: responseTime,
      success: true
    });

    // Send response with token counts
    res.json({
      success: true,
      response: responseContent,
      message: apiResponse.choices?.[0]?.message,
      tokenUsage: {
        input: inputTokens,
        output: responseTokens,
        total: totalTokens,
        // New token system fields
        tokensMonthly: userTokenData?.tokens_monthly || 0,
        tokensUsed: userTokenData?.tokens_used || 0,
        tokensAdded: userTokenData?.tokens_added || 0,
        tokensUsedAllTime: userTokenData?.tokens_used_all_time || 0,
        availableTokens: tokenUpdateResult.availableTokens,
        // Include API-reported usage if available
        apiReported: apiResponse.usage || null
      },
      metadata: {
        model: apiResponse.model || model || 'deepseek-chat',
        finishReason: apiResponse.choices?.[0]?.finish_reason,
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        userId: userId || null,
        isAnonymous: isAnonymous
      }
    });

  } catch (error) {
    console.error('=== DeepSeek API Error ===');
    console.error('Error:', error.message);
    console.error('Timestamp:', new Date().toISOString());
    console.error('==========================\n');

    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize user endpoint - creates user if doesn't exist and returns token info
app.post('/api/user/initialize', async (req, res) => {
  try {
    const { userId, authId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: 'Database not configured'
      });
    }

    // Get user's IP address
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    console.log('=== User Initialize Request ===');
    console.log('Anonymous ID:', userId);
    console.log('Auth ID:', authId || 'none');
    console.log('IP Address:', ipAddress);

    // Get or create user
    const user = await getOrCreateUser(userId, authId, ipAddress);

    if (!user) {
      console.error('❌ Failed to create user');
      return res.status(500).json({
        error: 'Failed to create user'
      });
    }

    console.log('✓ User found/created:', user.id);
    console.log('  - Is Anonymous:', !user.auth_id);

    // Note: Monthly reset would be handled by a cron job or database trigger

    // Fetch updated user data with new token fields
    const { data: updatedUser, error } = await supabase
      .from('users')
      .select('id, auth_id, tokens_monthly, tokens_used, tokens_added, tokens_used_all_time')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('❌ Failed to fetch user data:', error.message);
      return res.status(500).json({
        error: 'Failed to fetch user data',
        details: error.message
      });
    }

    // Calculate available tokens
    const availableTokens = calculateAvailableTokens(updatedUser);

    console.log('✓ User data retrieved');
    console.log('  - Tokens Monthly:', updatedUser.tokens_monthly);
    console.log('  - Tokens Used:', updatedUser.tokens_used);
    console.log('  - Tokens Added:', updatedUser.tokens_added);
    console.log('  - Tokens Used All Time:', updatedUser.tokens_used_all_time);
    console.log('  - Available:', availableTokens);
    console.log('===============================\n');

    res.json({
      success: true,
      userId: updatedUser.id,
      tokensMonthly: updatedUser.tokens_monthly || 0,
      tokensUsed: updatedUser.tokens_used || 0,
      tokensAdded: updatedUser.tokens_added || 0,
      tokensUsedAllTime: updatedUser.tokens_used_all_time || 0,
      availableTokens: availableTokens,
      isAnonymous: !updatedUser.auth_id
    });

  } catch (error) {
    console.error('Error initializing user:', error);
    res.status(500).json({
      error: 'Failed to initialize user',
      details: error.message
    });
  }
});

// Get user token usage endpoint
app.post('/api/user/tokens/', async (req, res) => {
  try {
    const { userId, authId } = req.body;

    // console.log('\n[/api/user/tokens] ========================================');
    // console.log('[/api/user/tokens] Request received');
    // console.log('[/api/user/tokens] userId:', userId);
    // console.log('[/api/user/tokens] authId:', authId);

    if (!supabase) {
      // console.error('[/api/user/tokens] ERROR: Database not configured');
      return res.status(503).json({
        error: 'Database not configured'
      });
    }

    // Find user(s) by anon_id or auth_id (do NOT use .single() so multiples don't throw)
    let query = supabase
      .from('users')
      .select('tokens_monthly, tokens_used, tokens_added, tokens_used_all_time, tier_id, stripe_subscription_id, subscription_status, stripe_customer_id, email, next_billing_date');

    if (authId) {
      // console.log('[/api/user/tokens] Querying by auth_id:', authId);
      query = query.eq('auth_id', authId);
    } else {
      // console.log('[/api/user/tokens] Querying by anon_id:', userId);
      query = query.eq('anon_id', userId);
    }

    const { data: users, error } = await query;

    // if (error) {
    //   console.error('[/api/user/tokens] Query error:', error);
    // }
    // console.log('[/api/user/tokens] Users found:', users ? users.length : 0);

    if (error || !users || users.length === 0) {
      // console.log('[/api/user/tokens] No user found, returning error');
      return res.json({
        error: error || 'User not found'
      });
    }

    const user = users[0];
    // console.log('[/api/user/tokens] User data from DB:');
    // console.log('[/api/user/tokens]   - email:', user.email);
    // console.log('[/api/user/tokens]   - tier_id:', user.tier_id);
    // console.log('[/api/user/tokens]   - subscription_status:', user.subscription_status);
    // console.log('[/api/user/tokens]   - stripe_subscription_id:', user.stripe_subscription_id);
    // console.log('[/api/user/tokens]   - stripe_customer_id:', user.stripe_customer_id);
    // console.log('[/api/user/tokens]   - tokens_monthly:', user.tokens_monthly);
    // console.log('[/api/user/tokens]   - tokens_used:', user.tokens_used);
    // console.log('[/api/user/tokens]   - tokens_added:', user.tokens_added);

    // Calculate available tokens using new model
    const tokensMonthly = Number(user.tokens_monthly) || 0;
    const tokensAdded = Number(user.tokens_added) || 0;
    const availableTokens = tokensMonthly + tokensAdded;
    
    // Get tier name for display - tier_id stores numeric ID (1-4)
    const tierId = Number(user.tier_id) || null;
    const tierData = tierId ? getTierById(tierId) : null;
    const tierName = tierData?.title || null;

    const responseData = {
      availableTokens: availableTokens,
      tokens_monthly: tokensMonthly,
      tokensMonthly: tokensMonthly,
      tokens_used: user.tokens_used || 0,
      tokensUsed: user.tokens_used || 0,
      tokens_added: tokensAdded,
      tokensAdded: tokensAdded,
      tokens_used_all_time: user.tokens_used_all_time || 0,
      tokensUsedAllTime: user.tokens_used_all_time || 0,
      tier_id: tierId,
      subscription_tier_id: tierId, // Explicit tier_id field
      subscription_tier_name: tierName, // Display name (e.g., 'Light', 'Basic', 'Standard', 'Heavy')
      stripe_subscription_id: user.stripe_subscription_id || null,
      subscription_status: user.subscription_status || null,
      next_billing_date: user.next_billing_date || null
    };

    // console.log('[/api/user/tokens] Response:', JSON.stringify(responseData, null, 2));
    // console.log('[/api/user/tokens] ========================================\n');

    res.json(responseData);

  } catch (error) {
    console.error('Error fetching user tokens:', error);
    res.status(500).json({
      error: 'Failed to fetch user data'
    });
  }
});

// Update user subscription tier by authId and return updated token info
// NOTE: This is a legacy/dev endpoint and does NOT create real Stripe subscriptions.
// It stores the numeric tier_id (1-4) in tier_id column.
app.post('/api/user/subscription', async (req, res) => {
  try {
    const { authId, subscriptionType } = req.body || {};

    if (!authId || !subscriptionType) {
      return res.status(400).json({
        error: 'authId and subscriptionType are required'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: 'Database not configured'
      });
    }

    // Normalize subscriptionType to a numeric tier_id (1-4)
    // - If caller passes a number or numeric string, use it directly
    // - If caller passes a tier key (e.g., 'light', 'basic'), look it up in subscription_tiers
    let tierId = null;

    if (typeof subscriptionType === 'number') {
      tierId = subscriptionType;
    } else if (typeof subscriptionType === 'string') {
      const parsed = Number(subscriptionType);
      if (Number.isFinite(parsed) && parsed > 0) {
        tierId = parsed;
      } else {
        const tierByKey = getTierByKey(subscriptionType);
        if (tierByKey && typeof tierByKey.tier_id === 'number') {
          tierId = tierByKey.tier_id;
        }
      }
    }

    if (!tierId) {
      console.error('[/api/user/subscription] Invalid subscriptionType, could not resolve tier_id:', subscriptionType);
      return res.status(400).json({
        error: 'Invalid subscriptionType; must be a valid tier key or numeric tier_id'
      });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ tier_id: tierId })
      .eq('auth_id', authId);

    if (updateError) {
      console.error('[/api/user/subscription] Failed to update subscription:', updateError);
      return res.status(500).json({
        error: 'Failed to update subscription',
        details: updateError.message
      });
    }

    // Re-query user and compute updated token info (same shape as /api/user/tokens/)
    const { data: users, error } = await supabase
      .from('users')
      .select('tokens_monthly, tokens_used, tokens_added, tokens_used_all_time, tier_id')
      .eq('auth_id', authId);

    if (error || !users || users.length === 0) {
      console.error('[/api/user/subscription] Failed to load user after update:', error);
      return res.status(500).json({
        error: 'Failed to load user after subscription update'
      });
    }

    const user = users[0];

    // Calculate available tokens using new model
    const tokensMonthly = Number(user.tokens_monthly) || 0;
    const tokensAdded = Number(user.tokens_added) || 0;
    const availableTokens = tokensMonthly + tokensAdded;

    return res.json({
      availableTokens,
      tokens_monthly: tokensMonthly,
      tokensMonthly: tokensMonthly,
      tokens_used: user.tokens_used || 0,
      tokens_added: tokensAdded,
      tokens_used_all_time: user.tokens_used_all_time || 0,
      tier_id: user.tier_id || null
    });
  } catch (error) {
    console.error('Error in /api/user/subscription:', error);
    res.status(500).json({
      error: 'Failed to update subscription',
      details: error.message
    });
  }
});

// Add one-time tokens for a user by authId and return updated token info
// Per TOKEN_TRACKING.md: One-time purchases/bonuses go to tokens_added, NOT tokens_monthly
app.post('/api/user/add-tokens', async (req, res) => {
  try {
    const { authId, tokensToAdd } = req.body || {};

    if (!authId || !Number.isFinite(Number(tokensToAdd)) || Number(tokensToAdd) <= 0) {
      return res.status(400).json({
        error: 'authId and positive numeric tokensToAdd are required'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: 'Database not configured'
      });
    }

    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, tokens_monthly, tokens_used, tokens_added, tokens_used_all_time, tier_id')
      .eq('auth_id', authId);

    if (fetchError || !users || users.length === 0) {
      console.error('[/api/user/add-tokens] Failed to load user:', fetchError);
      return res.status(500).json({
        error: 'Failed to load user for add-tokens'
      });
    }

    const user = users[0];
    const currentAdded = Number(user.tokens_added) || 0;
    const newTokensAdded = currentAdded + Number(tokensToAdd);

    const { error: updateError } = await supabase
      .from('users')
      .update({ tokens_added: newTokensAdded })
      .eq('id', user.id);

    if (updateError) {
      console.error('[/api/user/add-tokens] Failed to update tokens_added:', updateError);
      return res.status(500).json({
        error: 'Failed to add tokens',
        details: updateError.message
      });
    }

    // Calculate available tokens using new model
    const tokensMonthly = Number(user.tokens_monthly) || 0;
    const availableTokens = tokensMonthly + newTokensAdded;

    return res.json({
      availableTokens,
      tokens_monthly: tokensMonthly,
      tokensMonthly: tokensMonthly,
      tokens_used: user.tokens_used || 0,
      tokens_added: newTokensAdded,
      tokens_used_all_time: user.tokens_used_all_time || 0,
      tier_id: user.tier_id || null
    });
  } catch (error) {
    console.error('Error in /api/user/add-tokens:', error);
    res.status(500).json({
      error: 'Failed to add tokens',
      details: error.message
    });
  }
});

app.post('/api/users/ensure', async (req, res) => {
  try {
    const { anonId } = req.body || {};

    if (!anonId) {
      return res.status(400).json({
        error: 'anonId is required'
      });
    }

    if (!supabase) {
      const now = new Date().toISOString();
      const user = {
        ...DEFAULT_USER_TEMPLATE,
        anon_id: anonId,
        reset_date: now,
        exists: false,
        fromDatabase: false
      };
      return res.json(user);
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const user = await getOrCreateUser(anonId, null, ipAddress);

    if (!user) {
      return res.status(500).json({
        error: 'Failed to get or create user'
      });
    }

    return res.json({
      ...user,
      exists: true,
      fromDatabase: true
    });
  } catch (error) {
    console.error('Error in /api/users/ensure:', error);
    res.status(500).json({
      error: 'Failed to ensure user',
      details: error.message
    });
  }
});

// ============================================================================
// STRIPE ENDPOINTS
// ============================================================================

/**
 * Create Stripe Checkout Session
 * POST /api/stripe/create-checkout
 * Body: { authId, priceId } or { authId, subscriptionType }
 */
app.post('/api/stripe/create-checkout', async (req, res) => {
  try {
    const { authId, priceId, subscriptionType } = req.body;

    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    if (!authId) {
      return res.status(400).json({ error: 'authId is required' });
    }

    // Determine the Stripe price ID
    let stripePriceId = priceId;
    if (!stripePriceId && subscriptionType) {
      const tier = subscription_tiers[subscriptionType];
      if (tier && tier.stripe_price_id) {
        stripePriceId = tier.stripe_price_id;
      }
    }

    if (!stripePriceId) {
      return res.status(400).json({ error: 'priceId or valid subscriptionType is required' });
    }

    // Get user from database
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('auth_id', authId);

    if (userError || !users || users.length === 0) {
      console.error('[/api/stripe/create-checkout] User not found:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    let customerId = user.stripe_customer_id;

    // If user doesn't have a Stripe customer ID, create one
    if (!customerId) {
      console.log('[/api/stripe/create-checkout] Creating new Stripe customer for:', user.email);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { authId }
      });
      customerId = customer.id;

      // Save the Stripe customer ID to the user
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('auth_id', authId);

      console.log('[/api/stripe/create-checkout] Stripe customer created:', customerId);
    }

    // Determine success/cancel URLs
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${frontendUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/account?checkout=cancel`,
      metadata: { authId, subscriptionType: subscriptionType || null }
    });

    console.log('[/api/stripe/create-checkout] Checkout session created:', session.id);
    console.log('[/api/stripe/create-checkout] Full checkout session object from Stripe:', JSON.stringify(session, null, 2));

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('[/api/stripe/create-checkout] Error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 * Handles subscription lifecycle events
 */
app.post('/api/stripe/webhook', async (req, res) => {
  console.log('\n========================================');
  console.log('[STRIPE WEBHOOK] Incoming webhook request');
  console.log('========================================');
  
  if (!stripe) {
    console.error('[STRIPE WEBHOOK] ERROR: Stripe not configured');
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  console.log('[STRIPE WEBHOOK] Signature present:', !!sig);
  console.log('[STRIPE WEBHOOK] Webhook secret configured:', !!webhookSecret);

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('[STRIPE WEBHOOK] Signature verified successfully');
    } else {
      // For testing without webhook signature verification
      console.warn('[STRIPE WEBHOOK] WARNING: No webhook secret configured, parsing body directly');
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[STRIPE WEBHOOK] ERROR: Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[STRIPE WEBHOOK] Event type:', event.type);
  console.log('[STRIPE WEBHOOK] Event ID:', event.id);
  console.log('[STRIPE WEBHOOK] Event data:', JSON.stringify(event.data.object, null, 2));

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('\n--- CHECKOUT SESSION COMPLETED ---');
        console.log('[STRIPE WEBHOOK] Session ID:', session.id);
        console.log('[STRIPE WEBHOOK] Customer:', session.customer);
        console.log('[STRIPE WEBHOOK] Customer email:', session.customer_email);
        console.log('[STRIPE WEBHOOK] Subscription:', session.subscription);
        console.log('[STRIPE WEBHOOK] Client reference ID:', session.client_reference_id);
        console.log('[STRIPE WEBHOOK] Metadata:', JSON.stringify(session.metadata));
        console.log('[STRIPE WEBHOOK] Full checkout session object (for debugging billing dates):', JSON.stringify(session, null, 2));
        
        // Get the subscription from the session
        if (session.subscription) {
          console.log('[STRIPE WEBHOOK] Retrieving subscription details...');
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          console.log('[STRIPE WEBHOOK] Subscription retrieved:', subscription.id);
          console.log('[STRIPE WEBHOOK] Full subscription object from Stripe (checkout.session.completed):', JSON.stringify(subscription, null, 2));
          console.log('[STRIPE WEBHOOK] Subscription current_period_start:', subscription.current_period_start, '->', subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null);
          console.log('[STRIPE WEBHOOK] Subscription current_period_end:', subscription.current_period_end, '->', subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null);
          
          // Pass client_reference_id as authId if available
          const metadata = {
            ...session.metadata,
            authId: session.client_reference_id || session.metadata?.authId,
            customerEmail: session.customer_email
          };
          console.log('[STRIPE WEBHOOK] Calling handleSubscriptionUpdate with metadata:', JSON.stringify(metadata));
          await handleSubscriptionUpdate(subscription, metadata);
        } else {
          console.log('[STRIPE WEBHOOK] No subscription in session, skipping');
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log(`\n--- SUBSCRIPTION ${event.type.toUpperCase()} ---`);
        console.log('[STRIPE WEBHOOK] Subscription ID:', subscription.id);
        console.log('[STRIPE WEBHOOK] Customer:', subscription.customer);
        console.log('[STRIPE WEBHOOK] Status:', subscription.status);
        console.log('[STRIPE WEBHOOK] Price ID:', subscription.items?.data?.[0]?.price?.id);
        console.log('[STRIPE WEBHOOK] Full subscription object from Stripe (subscription.* event):', JSON.stringify(subscription, null, 2));
        console.log('[STRIPE WEBHOOK] Subscription current_period_start:', subscription.current_period_start, '->', subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null);
        console.log('[STRIPE WEBHOOK] Subscription current_period_end:', subscription.current_period_end, '->', subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null);
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('\n--- SUBSCRIPTION DELETED ---');
        console.log('[STRIPE WEBHOOK] Subscription ID:', subscription.id);
        await handleSubscriptionCancellation(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('\n--- INVOICE PAYMENT SUCCEEDED ---');
        console.log('[STRIPE WEBHOOK] Invoice ID:', invoice.id);
        console.log('[STRIPE WEBHOOK] Customer:', invoice.customer);
        console.log('[STRIPE WEBHOOK] Subscription:', invoice.subscription);
        console.log('[STRIPE WEBHOOK] Full invoice object from Stripe (payment_succeeded):', JSON.stringify(invoice, null, 2));
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          console.log('[STRIPE WEBHOOK] Full subscription object from Stripe (invoice.payment_succeeded):', JSON.stringify(subscription, null, 2));
          console.log('[STRIPE WEBHOOK] Subscription current_period_start:', subscription.current_period_start, '->', subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null);
          console.log('[STRIPE WEBHOOK] Subscription current_period_end:', subscription.current_period_end, '->', subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null);
          await handleSubscriptionRenewal(subscription);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('\n--- INVOICE PAYMENT FAILED ---');
        console.log('[STRIPE WEBHOOK] Invoice ID:', invoice.id);
        console.log('[STRIPE WEBHOOK] Customer:', invoice.customer);
        break;
      }

      default:
        console.log('[STRIPE WEBHOOK] Unhandled event type:', event.type);
    }

    console.log('[STRIPE WEBHOOK] Webhook processed successfully');
    console.log('========================================\n');
    res.json({ received: true });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] ERROR processing event:', error);
    console.error('[STRIPE WEBHOOK] Error stack:', error.stack);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Helper: Handle subscription update (created or updated)
 */
async function handleSubscriptionUpdate(subscription, metadata = {}) {
  console.log('\n--- handleSubscriptionUpdate START ---');
  
  if (!supabase) {
    console.error('[handleSubscriptionUpdate] ERROR: Supabase not configured');
    return;
  }

  const customerId = subscription.customer;
  const stripeSubscriptionId = subscription.id;
  const status = subscription.status;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  
  // Check if this is a scheduled change (downgrade/cancel at period end)
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const scheduledChange = subscription.schedule; // If there's a scheduled change

  console.log('[handleSubscriptionUpdate] Subscription details:');
  console.log('  - Customer ID:', customerId);
  console.log('  - Subscription ID:', stripeSubscriptionId);
  console.log('  - Status:', status);
  console.log('  - Price ID:', priceId);
  console.log('  - Metadata:', JSON.stringify(metadata));

  // Find the tier_id from the price ID - store tier_id (1-4) not tier name
  let tierIdFromStripe = null;
  console.log('[handleSubscriptionUpdate] Looking up tier_id from price ID...');
  console.log('[handleSubscriptionUpdate] Price ID:', priceId);
  
  tierIdFromStripe = getTierIdFromPriceId(priceId);
  
  if (tierIdFromStripe) {
    console.log(`[handleSubscriptionUpdate] MATCH FOUND: tier_id=${tierIdFromStripe}`);
  }

  // Fallback: try to get tier from metadata or product name
  if (!tierIdFromStripe && priceId) {
    console.log('[handleSubscriptionUpdate] Attempting to retrieve price details from Stripe...');
    try {
      const price = await stripe.prices.retrieve(priceId);
      console.log('[handleSubscriptionUpdate] Price details:', JSON.stringify(price, null, 2));
      
      // Try to match by price amount
      const amount = price.unit_amount / 100; // Convert cents to dollars
      console.log('[handleSubscriptionUpdate] Price amount:', amount);
      
      for (const [key, tier] of Object.entries(subscription_tiers)) {
        if (Math.abs(tier.monthly_price - amount) < 0.01) {
          tierIdFromStripe = tier.tier_id;
          console.log(`[handleSubscriptionUpdate] Matched by price amount: tier_id=${tier.tier_id}`);
          break;
        }
      }
      
      // Also try to get product name
      if (!tierIdFromStripe && price.product) {
        const product = await stripe.products.retrieve(price.product);
        console.log('[handleSubscriptionUpdate] Product name:', product.name);
        const productNameLower = product.name.toLowerCase();
        let matchedKey = null;
        if (productNameLower.includes('light')) matchedKey = 'light';
        else if (productNameLower.includes('basic')) matchedKey = 'basic';
        else if (productNameLower.includes('full') || productNameLower.includes('standard')) matchedKey = 'full';
        else if (productNameLower.includes('heavy')) matchedKey = 'heavy';
        if (matchedKey) {
          tierIdFromStripe = subscription_tiers[matchedKey].tier_id;
          console.log(`[handleSubscriptionUpdate] Matched by product name: tier_id=${tierIdFromStripe}`);
        }
      }
    } catch (priceErr) {
      console.error('[handleSubscriptionUpdate] Error retrieving price:', priceErr.message);
    }
  }

  console.log('[handleSubscriptionUpdate] Final tier_id from Stripe:', tierIdFromStripe);
  
  if (!tierIdFromStripe) {
    console.error('[handleSubscriptionUpdate] ERROR: Could not determine tier_id from Stripe data');
    return;
  }

  // Find user - try multiple methods
  let user = null;
  
  // Method 1: By Stripe customer ID
  console.log('[handleSubscriptionUpdate] Looking up user by stripe_customer_id:', customerId);
  const { data: usersByCustomer, error: customerError } = await supabase
    .from('users')
    .select('id, auth_id, email, tokens_used, tokens_monthly, stripe_customer_id, tier_id')
    .eq('stripe_customer_id', customerId);

  if (customerError) {
    console.error('[handleSubscriptionUpdate] Error querying by customer ID:', customerError);
  } else {
    console.log('[handleSubscriptionUpdate] Users found by customer ID:', usersByCustomer?.length || 0);
    if (usersByCustomer && usersByCustomer.length > 0) {
      user = usersByCustomer[0];
      console.log('[handleSubscriptionUpdate] Found user by customer ID:', user.id);
    }
  }

  // Method 2: By authId from metadata (client_reference_id)
  if (!user && metadata.authId) {
    console.log('[handleSubscriptionUpdate] Looking up user by auth_id:', metadata.authId);
    const { data: usersByAuth, error: authError } = await supabase
      .from('users')
      .select('id, auth_id, email, tokens_used, tokens_monthly, stripe_customer_id, tier_id')
      .eq('auth_id', metadata.authId);

    if (authError) {
      console.error('[handleSubscriptionUpdate] Error querying by auth_id:', authError);
    } else {
      console.log('[handleSubscriptionUpdate] Users found by auth_id:', usersByAuth?.length || 0);
      if (usersByAuth && usersByAuth.length > 0) {
        user = usersByAuth[0];
        console.log('[handleSubscriptionUpdate] Found user by auth_id:', user.id);
      }
    }
  }

  // Method 3: By email from metadata
  if (!user && metadata.customerEmail) {
    console.log('[handleSubscriptionUpdate] Looking up user by email:', metadata.customerEmail);
    const { data: usersByEmail, error: emailError } = await supabase
      .from('users')
      .select('id, auth_id, email, tokens_used, tokens_monthly, stripe_customer_id, tier_id')
      .eq('email', metadata.customerEmail);

    if (emailError) {
      console.error('[handleSubscriptionUpdate] Error querying by email:', emailError);
    } else {
      console.log('[handleSubscriptionUpdate] Users found by email:', usersByEmail?.length || 0);
      if (usersByEmail && usersByEmail.length > 0) {
        user = usersByEmail[0];
        console.log('[handleSubscriptionUpdate] Found user by email:', user.id);
      }
    }
  }

  // Method 4: Get customer email from Stripe and look up
  if (!user) {
    console.log('[handleSubscriptionUpdate] Attempting to get customer email from Stripe...');
    try {
      const customer = await stripe.customers.retrieve(customerId);
      console.log('[handleSubscriptionUpdate] Stripe customer email:', customer.email);
      
      if (customer.email) {
        const { data: usersByStripeEmail, error: stripeEmailError } = await supabase
          .from('users')
          .select('id, auth_id, email, tokens_used, tokens_monthly, stripe_customer_id, tier_id')
          .eq('email', customer.email);

        if (!stripeEmailError && usersByStripeEmail && usersByStripeEmail.length > 0) {
          user = usersByStripeEmail[0];
          console.log('[handleSubscriptionUpdate] Found user by Stripe customer email:', user.id);
        }
      }
    } catch (custErr) {
      console.error('[handleSubscriptionUpdate] Error retrieving Stripe customer:', custErr.message);
    }
  }

  if (!user) {
    console.error('[handleSubscriptionUpdate] ERROR: Could not find user by any method!');
    console.error('[handleSubscriptionUpdate] Tried: customer_id, auth_id, email');
    return;
  }

  console.log('[handleSubscriptionUpdate] User found:', JSON.stringify(user, null, 2));

  // Calculate billing cycle day and subscription end date
  const periodStartTs = getSubscriptionCurrentPeriodStartTimestamp(subscription);
  const periodEndTs = getSubscriptionCurrentPeriodEndTimestamp(subscription);
  const currentPeriodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;

  // Billing cycle day should be derived from the start of the period (UTC day of month)
  const billingStartDate = periodStartTs ? new Date(periodStartTs * 1000) : currentPeriodEnd;
  const billingCycleDay = billingStartDate ? billingStartDate.getUTCDate() : null;

  console.log('[handleSubscriptionUpdate] Billing info:');
  console.log('  - Current period end:', currentPeriodEnd);
  console.log('  - Billing cycle day:', billingCycleDay);

  // Determine if this is an upgrade, downgrade, or same tier using tier_id (1-4)
  const currentTierId = Number(user.tier_id) || null;
  const newTierId = tierIdFromStripe;
  
  // Get tier data for logging and tokens_monthly lookup
  const currentTierData = currentTierId ? getTierById(currentTierId) : null;
  const newTierData = getTierById(newTierId);
  
  const currentAllowance = currentTierData?.monthly_allowance || 0;
  const newAllowance = newTierData?.monthly_allowance || 0;
  
  // Compare using numeric tier_id - higher tier_id = higher plan
  const isUpgrade = newTierId > currentTierId && currentTierId !== null;
  const isDowngrade = newTierId < currentTierId && currentTierId !== null;
  const isSameTier = currentTierId === newTierId;
  
  console.log('[handleSubscriptionUpdate] Tier comparison:');
  console.log('  - Current tier_id:', currentTierId, currentTierData?.title || 'null', '(', currentAllowance, 'tokens)');
  console.log('  - New tier_id:', newTierId, newTierData?.title || 'unknown', '(', newAllowance, 'tokens)');
  console.log('  - Is upgrade:', isUpgrade);
  console.log('  - Is downgrade:', isDowngrade);
  console.log('  - Is same tier:', isSameTier);
  console.log('  - Cancel at period end:', cancelAtPeriodEnd);

  // Update user subscription data
  // Per TOKEN_TRACKING.md:
  // - NEW SUBSCRIPTION: tokens_monthly = max(current, tierLimit), tokens_used = 0
  // - UPGRADE: tokens_monthly = max(current, newTierLimit) - user paid extra
  // - DOWNGRADE: Don't reduce tokens_monthly until renewal
  // - SAME TIER: Don't touch tokens_monthly
  const updateData = {
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubscriptionId,
    tier_id: newTierId,
    subscription_status: status,
    subscription_end_date: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
    next_billing_date: currentPeriodEnd ? currentPeriodEnd.toISOString() : null
  };

  // Get current user's tokens_monthly from DB
  const currentTokensMonthly = Number(user.tokens_monthly) || 0;

  // Handle tokens_monthly changes based on upgrade vs downgrade
  // Per TOKEN_TRACKING.md Section 3:
  // - NEW SUBSCRIPTION: tokens_monthly = max(currentMonthly, tierLimit), tokens_used = 0
  // - RENEWAL: tokens_monthly = max(tokens_monthly, tierLimit) - never reduced by renewal
  // - UPGRADE: Immediately set tokens_monthly = max(current, newAllowance)
  // - DOWNGRADE: Keep current tokens_monthly until next billing
  if (currentTierId === null) {
    // New subscription - set tokens_monthly to max(current, tierLimit)
    updateData.tokens_monthly = Math.max(currentTokensMonthly, newAllowance);
    updateData.tokens_used = 0;
    console.log('[handleSubscriptionUpdate] New subscription - setting tokens_monthly to:', updateData.tokens_monthly);
  } else if (isUpgrade) {
    // Upgrade - set tokens_monthly to max(current, newAllowance)
    updateData.tokens_monthly = Math.max(currentTokensMonthly, newAllowance);
    console.log('[handleSubscriptionUpdate] Upgrade - updating tokens_monthly to:', updateData.tokens_monthly);
  } else if (isDowngrade) {
    // Downgrade - keep current tokens_monthly until next billing
    // When invoice.payment_succeeded fires, renewal logic will apply
    console.log('[handleSubscriptionUpdate] Downgrade - keeping tokens_monthly at:', currentTokensMonthly);
    console.log('[handleSubscriptionUpdate] tokens_monthly will update at renewal via max(current, newTierLimit)');
  } else if (isSameTier) {
    // Same tier - don't change tokens_monthly
    console.log('[handleSubscriptionUpdate] Same tier - keeping tokens_monthly at:', currentTokensMonthly);
  } else {
    // This should never happen with tier_id comparison, but log it for safety
    console.warn('[handleSubscriptionUpdate] WARNING: Unexpected tier comparison state');
    console.warn('[handleSubscriptionUpdate] Current:', currentTierId, 'New:', newTierId);
  }

  console.log('[handleSubscriptionUpdate] Token behavior:');
  console.log('  - Current tokens_monthly in DB:', currentTokensMonthly);
  console.log('  - New tier allowance:', newAllowance);
  console.log('  - Will set tokens_monthly to:', updateData.tokens_monthly ?? '(unchanged)');

  console.log('[handleSubscriptionUpdate] Update data:', JSON.stringify(updateData, null, 2));

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id)
    .select();

  if (updateError) {
    console.error('[handleSubscriptionUpdate] ERROR: Failed to update user:', updateError);
  } else {
    console.log('[handleSubscriptionUpdate] SUCCESS: User subscription updated');
    console.log('[handleSubscriptionUpdate] Updated user data:', JSON.stringify(updatedUser, null, 2));
  }
  
  console.log('--- handleSubscriptionUpdate END ---\n');
}

/**
 * Helper: Handle subscription cancellation
 * This is called when subscription.deleted fires - meaning the subscription has ACTUALLY ended
 * (either immediate cancel or cancel_at_period_end has reached its end date)
 * 
 * Per TOKEN_TRACKING.md: Keep remaining tokens_monthly until spent, then only use tokens_added
 * For now, we set tokens_monthly to 0 on cancel (exact behavior can be refined later)
 */
async function handleSubscriptionCancellation(subscription) {
  if (!supabase) return;

  const customerId = subscription.customer;
  const stripeSubscriptionId = subscription.id;

  console.log('[handleSubscriptionCancellation] Processing cancellation:', stripeSubscriptionId);
  console.log('[handleSubscriptionCancellation] Subscription ended_at:', subscription.ended_at);

  // Find user by Stripe customer ID or subscription ID
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, tier_id, tokens_monthly')
    .or(`stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${stripeSubscriptionId}`);

  if (findError || !users || users.length === 0) {
    console.error('[handleSubscriptionCancellation] User not found');
    return;
  }

  const user = users[0];
  console.log('[handleSubscriptionCancellation] User had tier_id:', user.tier_id);
  console.log('[handleSubscriptionCancellation] User had tokens_monthly:', user.tokens_monthly);

  // Subscription has actually ended - now remove access
  // Per TOKEN_TRACKING.md: On cancel, we zero out tokens_monthly (they lose monthly allowance)
  // tokens_added remains intact for use
  const { error: updateError } = await supabase
    .from('users')
    .update({
      tier_id: null,
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      subscription_end_date: null,
      next_billing_date: null,
      tokens_monthly: 0 // Remove monthly token allowance
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('[handleSubscriptionCancellation] Failed to update user:', updateError);
  } else {
    console.log('[handleSubscriptionCancellation] User subscription canceled successfully');
  }
}

/**
 * Helper: Handle subscription renewal (monthly payment)
 * Per TOKEN_TRACKING.md Section 5:
 * - tokens_used = 0 (reset monthly usage counter)
 * - tokens_monthly = max(tokens_monthly, tierLimit) (never reduce, only top-up)
 * - tokens_added unchanged
 * - tokens_used_all_time unchanged
 */
async function handleSubscriptionRenewal(subscription) {
  if (!supabase) return;

  const customerId = subscription.customer;
  const status = subscription.status;
  const priceId = subscription.items?.data?.[0]?.price?.id;

  if (status !== 'active') return;

  console.log('[handleSubscriptionRenewal] Processing renewal for customer:', customerId);

  // Determine tier_id from current price ID
  const newTierId = getTierIdFromPriceId(priceId);
  
  if (!newTierId) {
    console.error('[handleSubscriptionRenewal] Could not determine tier_id from price:', priceId);
    return;
  }
  
  const newTierData = getTierById(newTierId);
  const tierLimit = newTierData?.monthly_allowance || 0;
  console.log('[handleSubscriptionRenewal] Renewal tier_id:', newTierId, newTierData?.title || 'unknown', 'tierLimit:', tierLimit);

  // Find user by Stripe customer ID
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, tier_id, tokens_monthly')
    .eq('stripe_customer_id', customerId);

  if (findError || !users || users.length === 0) {
    console.error('[handleSubscriptionRenewal] User not found');
    return;
  }

  const user = users[0];
  const currentTierId = Number(user.tier_id) || null;
  const currentTokensMonthly = Number(user.tokens_monthly) || 0;
  
  console.log('[handleSubscriptionRenewal] Current DB tier_id:', currentTierId);
  console.log('[handleSubscriptionRenewal] Current DB tokens_monthly:', currentTokensMonthly);

  // Calculate next billing date from subscription
  const periodEndTs = getSubscriptionCurrentPeriodEndTimestamp(subscription);
  const currentPeriodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;

  // Per TOKEN_TRACKING.md Section 5:
  // tokens_monthly = max(tokens_monthly, tierLimit) - never reduce, only top-up
  const newTokensMonthly = Math.max(currentTokensMonthly, tierLimit);

  console.log('[handleSubscriptionRenewal] Tier limit from Stripe:', tierLimit);
  console.log('[handleSubscriptionRenewal] New tokens_monthly (max of current and tierLimit):', newTokensMonthly);

  // Build update data
  const updateData = {
    tokens_used: 0, // Reset monthly usage counter
    tokens_monthly: newTokensMonthly,
    tier_id: newTierId,
    next_billing_date: currentPeriodEnd ? currentPeriodEnd.toISOString() : null
  };

  // Reset monthly token usage and update subscription
  const { error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id);

  if (updateError) {
    console.error('[handleSubscriptionRenewal] Failed to reset tokens:', updateError);
  } else {
    console.log('[handleSubscriptionRenewal] Monthly tokens reset successfully');
    console.log('[handleSubscriptionRenewal] tokens_monthly:', currentTokensMonthly, '->', newTokensMonthly);
    console.log('[handleSubscriptionRenewal] tokens_used: reset to 0');
  }
}

/**
 * Create Stripe Customer Portal Session
 * POST /api/stripe/customer-portal
 * Body: { authId }
 */
app.post('/api/stripe/customer-portal', async (req, res) => {
  try {
    const { authId } = req.body;

    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    if (!authId) {
      return res.status(400).json({ error: 'authId is required' });
    }

    // Get user's Stripe customer ID
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('auth_id', authId);

    if (userError || !users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'User does not have a Stripe customer account' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${frontendUrl}/account`
    });

    console.log('[/api/stripe/customer-portal] Portal session created for customer:', user.stripe_customer_id);

    res.json({ url: session.url });
  } catch (error) {
    console.error('[/api/stripe/customer-portal] Error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get subscription status
 * POST /api/stripe/subscription-status
 * Body: { authId }
 */
app.post('/api/stripe/subscription-status', async (req, res) => {
  try {
    const { authId } = req.body;

    if (!authId) {
      return res.status(400).json({ error: 'authId is required' });
    }

    // Get user's subscription data
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('tier_id, subscription_status, stripe_subscription_id, subscription_end_date, next_billing_date')
      .eq('auth_id', authId);

    if (userError || !users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const tierId = Number(user.tier_id) || null;
    const tierData = tierId ? getTierById(tierId) : null;

    res.json({
      tier_id: tierId,
      tierName: tierData?.title || null,
      subscriptionStatus: user.subscription_status,
      stripeSubscriptionId: user.stripe_subscription_id,
      subscriptionEndDate: user.subscription_end_date,
      nextBillingDate: user.next_billing_date,
      hasActiveSubscription: user.subscription_status === 'active' && user.stripe_subscription_id
    });
  } catch (error) {
    console.error('[/api/stripe/subscription-status] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual Stripe Sync - DEV/ADMIN ONLY
 * POST /api/stripe/sync
 * Body: { authId, email }
 *
 * This endpoint is intended for:
 *   - Local development when webhooks are not configured.
 *   - Rare admin/support cases where a Stripe webhook failed and an operator
 *     needs to manually reconcile subscription metadata.
 *
 * IMPORTANT:
 *   - This endpoint should NOT be called as part of normal user flows or
 *     routine refreshes in the web portal.
 *   - It does NOT modify token buckets (tokens_monthly, tokens_added,
 *     tokens_used, tokens_used_all_time). Tokens are managed exclusively by
 *     the Stripe webhook handlers and dev simulation endpoints.
 *
 * Behavior:
 *   - Looks up the Stripe customer/subscription by email.
 *   - Updates stripe_customer_id, stripe_subscription_id, tier_id,
 *     subscription_status, and billing dates on the user row.
 */
app.post('/api/stripe/sync', async (req, res) => {
  console.log('\n[STRIPE SYNC] ========================================');
  console.log('[STRIPE SYNC] Manual sync requested');
  
  try {
    const { authId, email } = req.body;

    if (!stripe) {
      console.error('[STRIPE SYNC] ERROR: Stripe not configured');
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    if (!authId && !email) {
      return res.status(400).json({ error: 'authId or email is required' });
    }

    console.log('[STRIPE SYNC] authId:', authId);
    console.log('[STRIPE SYNC] email:', email);

    // Get user from database
    let userQuery = supabase.from('users').select('*');
    if (authId) {
      userQuery = userQuery.eq('auth_id', authId);
    } else {
      userQuery = userQuery.eq('email', email);
    }

    const { data: users, error: userError } = await userQuery;

    if (userError || !users || users.length === 0) {
      console.error('[STRIPE SYNC] User not found in database');
      return res.status(404).json({ error: 'User not found in database' });
    }

    const user = users[0];
    console.log('[STRIPE SYNC] Found user:', user.id, user.email);

    // Look up customer in Stripe by email
    const userEmail = email || user.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'No email available to look up Stripe customer' });
    }

    console.log('[STRIPE SYNC] Searching Stripe for customer with email:', userEmail);
    
    // Get ALL customers with this email (there might be duplicates)
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 100
    });

    console.log('[STRIPE SYNC] Found', customers.data.length, 'Stripe customer(s) with this email');
    customers.data.forEach((c, i) => {
      console.log(`[STRIPE SYNC]   Customer ${i + 1}: ${c.id} (created: ${new Date(c.created * 1000).toISOString()})`);
    });

    if (customers.data.length === 0) {
      console.log('[STRIPE SYNC] No Stripe customer found for this email');
      return res.json({ 
        message: 'No Stripe customer found for this email',
        synced: false 
      });
    }

    // Check ALL customers for subscriptions
    let allSubscriptions = [];
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 100
      });
      subs.data.forEach(sub => {
        allSubscriptions.push({ customer, subscription: sub });
      });

      // Verbose logging of each subscription object for this customer
      subs.data.forEach((sub, i) => {
        const priceId = sub.items?.data?.[0]?.price?.id;
        console.log(`[STRIPE SYNC]   Raw subscription for customer ${customer.id} #${i + 1}:`);
        console.log('[STRIPE SYNC]     ID:', sub.id);
        console.log('[STRIPE SYNC]     Status:', sub.status);
        console.log('[STRIPE SYNC]     Price ID:', priceId);
        console.log('[STRIPE SYNC]     current_period_start:', sub.current_period_start, '->', sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null);
        console.log('[STRIPE SYNC]     current_period_end:', sub.current_period_end, '->', sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null);
        console.log('[STRIPE SYNC]     Full subscription object:', JSON.stringify(sub, null, 2));
      });
    }

    console.log('[STRIPE SYNC] Total active subscriptions across all customers:', allSubscriptions.length);
    allSubscriptions.forEach((item, i) => {
      const priceId = item.subscription.items?.data?.[0]?.price?.id;
      console.log(`[STRIPE SYNC]   Subscription ${i + 1}: ${item.subscription.id} (customer: ${item.customer.id}, price: ${priceId}, created: ${new Date(item.subscription.created * 1000).toISOString()})`);
    });

    // Use the most recently created subscription
    allSubscriptions.sort((a, b) => b.subscription.created - a.subscription.created);
    
    const customer = allSubscriptions.length > 0 ? allSubscriptions[0].customer : customers.data[0];
    const subscriptions = { data: allSubscriptions.map(s => s.subscription) };

    console.log('[STRIPE SYNC] Using customer:', customer.id);
    console.log('[STRIPE SYNC] Active subscriptions found:', subscriptions.data.length);
    if (subscriptions.data.length > 0) {
      const chosenSub = subscriptions.data[0];
      console.log('[STRIPE SYNC] Chosen subscription for sync:', chosenSub.id);
      console.log('[STRIPE SYNC] Chosen subscription current_period_start:', chosenSub.current_period_start, '->', chosenSub.current_period_start ? new Date(chosenSub.current_period_start * 1000).toISOString() : null);
      console.log('[STRIPE SYNC] Chosen subscription current_period_end:', chosenSub.current_period_end, '->', chosenSub.current_period_end ? new Date(chosenSub.current_period_end * 1000).toISOString() : null);
      console.log('[STRIPE SYNC] Chosen subscription full object:', JSON.stringify(chosenSub, null, 2));
    }

    let updateData = {
      stripe_customer_id: customer.id
    };

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const priceId = subscription.items?.data?.[0]?.price?.id;
      
      console.log('[STRIPE SYNC] Subscription ID:', subscription.id);
      console.log('[STRIPE SYNC] Subscription status:', subscription.status);
      console.log('[STRIPE SYNC] Price ID:', priceId);

      // Determine tier_id from price ID
      let tierIdFromSync = getTierIdFromPriceId(priceId);

      // If no match, try by price amount or product name
      if (!tierIdFromSync && priceId) {
        try {
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount / 100;
          
          console.log('[STRIPE SYNC] Price amount:', amount);
          
          // Match by price amount
          for (const [key, tier] of Object.entries(subscription_tiers)) {
            if (Math.abs(tier.monthly_price - amount) < 0.01) {
              tierIdFromSync = tier.tier_id;
              console.log('[STRIPE SYNC] Matched by price amount: tier_id=', tier.tier_id);
              break;
            }
          }

          // Try product name
          if (!tierIdFromSync && price.product) {
            const product = await stripe.products.retrieve(price.product);
            console.log('[STRIPE SYNC] Product name:', product.name);
            const productNameLower = product.name.toLowerCase();
            let matchedKey = null;
            if (productNameLower.includes('light')) matchedKey = 'light';
            else if (productNameLower.includes('basic')) matchedKey = 'basic';
            else if (productNameLower.includes('full') || productNameLower.includes('standard')) matchedKey = 'full';
            else if (productNameLower.includes('heavy')) matchedKey = 'heavy';
            if (matchedKey) {
              tierIdFromSync = subscription_tiers[matchedKey].tier_id;
              console.log('[STRIPE SYNC] Matched by product name: tier_id=', tierIdFromSync);
            }
          }
        } catch (priceErr) {
          console.error('[STRIPE SYNC] Error retrieving price:', priceErr.message);
        }
      }

      console.log('[STRIPE SYNC] Determined tier_id:', tierIdFromSync);

      const periodEndTs = getSubscriptionCurrentPeriodEndTimestamp(subscription);
      const currentPeriodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;

      // NOTE: Manual sync only aligns subscription metadata; it does NOT touch
      // token buckets. Token refills and usage resets are handled solely by
      // the real webhook handlers and dev simulation endpoints.

      updateData = {
        ...updateData,
        stripe_subscription_id: subscription.id,
        tier_id: tierIdFromSync, // Store tier_id (1-4)
        subscription_status: subscription.status,
        subscription_end_date: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
        next_billing_date: currentPeriodEnd ? currentPeriodEnd.toISOString() : null
      };
    } else {
      console.log('[STRIPE SYNC] No active subscription, clearing subscription data');
      updateData = {
        ...updateData,
        stripe_subscription_id: null,
        tier_id: null,
        subscription_status: null
      };
    }

    console.log('[STRIPE SYNC] Update data:', JSON.stringify(updateData, null, 2));

    // Update user in database
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select();

    if (updateError) {
      console.error('[STRIPE SYNC] ERROR updating user:', updateError);
      return res.status(500).json({ error: 'Failed to update user', details: updateError });
    }

    console.log('[STRIPE SYNC] SUCCESS: User updated');
    console.log('[STRIPE SYNC] Updated user:', JSON.stringify(updatedUser, null, 2));
    console.log('[STRIPE SYNC] ========================================\n');

    res.json({
      message: 'Subscription synced successfully',
      synced: true,
      tier_id: updateData.tier_id,
      subscriptionStatus: updateData.subscription_status,
      stripeCustomerId: updateData.stripe_customer_id,
      stripeSubscriptionId: updateData.stripe_subscription_id
    });

  } catch (error) {
    console.error('[STRIPE SYNC] ERROR:', error);
    console.error('[STRIPE SYNC] Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DEVELOPER-ONLY ENDPOINTS
// Per TOKEN_TRACKING.md Section 7: Simulate Stripe webhook scenarios for testing
// These bypass Stripe signature validation and call the same business logic
// ============================================================================

/**
 * Reusable function: Apply subscription created logic
 * @param {string} authId - User's auth ID
 * @param {number} tierId - Subscription tier ID (1-4)
 * @returns {Promise<Object>} - Result with updated user data
 */
async function applySubscriptionCreated(authId, tierId) {
  if (!supabase) throw new Error('Database not configured');
  
  const tierData = getTierById(tierId);
  if (!tierData) throw new Error(`Invalid tier_id: ${tierId}`);
  
  const tierLimit = tierData.monthly_allowance || 0;
  
  // Find user
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, tokens_monthly, tokens_used, tokens_added, tokens_used_all_time')
    .eq('auth_id', authId);
  
  if (findError || !users || users.length === 0) {
    throw new Error('User not found');
  }
  
  const user = users[0];
  const currentTokensMonthly = Number(user.tokens_monthly) || 0;
  
  // Per TOKEN_TRACKING.md Section 3.1: tokens_monthly = max(current, tierLimit), tokens_used = 0
  const updateData = {
    tier_id: tierId,
    subscription_status: 'active',
    tokens_monthly: Math.max(currentTokensMonthly, tierLimit),
    tokens_used: 0
  };
  
  const { error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id);
  
  if (updateError) throw new Error(`Failed to update user: ${updateError.message}`);
  
  // Return updated user data
  const { data: updatedUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { success: true, user: updatedUser, applied: updateData };
}

/**
 * Reusable function: Apply subscription renewed logic
 * @param {string} authId - User's auth ID
 * @param {number} tierId - Subscription tier ID (1-4)
 * @returns {Promise<Object>} - Result with updated user data
 */
async function applySubscriptionRenewed(authId, tierId) {
  if (!supabase) throw new Error('Database not configured');
  
  const tierData = getTierById(tierId);
  if (!tierData) throw new Error(`Invalid tier_id: ${tierId}`);
  
  const tierLimit = tierData.monthly_allowance || 0;
  
  // Find user
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, tokens_monthly, tokens_used, tokens_added, tokens_used_all_time')
    .eq('auth_id', authId);
  
  if (findError || !users || users.length === 0) {
    throw new Error('User not found');
  }
  
  const user = users[0];
  const currentTokensMonthly = Number(user.tokens_monthly) || 0;
  
  // Per TOKEN_TRACKING.md Section 3.2/5: tokens_monthly = max(current, tierLimit), tokens_used = 0
  const updateData = {
    tier_id: tierId,
    tokens_monthly: Math.max(currentTokensMonthly, tierLimit),
    tokens_used: 0 // Reset monthly usage counter
  };
  
  const { error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id);
  
  if (updateError) throw new Error(`Failed to update user: ${updateError.message}`);
  
  // Return updated user data
  const { data: updatedUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { success: true, user: updatedUser, applied: updateData };
}

/**
 * Reusable function: Apply subscription canceled logic
 * @param {string} authId - User's auth ID
 * @returns {Promise<Object>} - Result with updated user data
 */
async function applySubscriptionCanceled(authId) {
  if (!supabase) throw new Error('Database not configured');
  
  // Find user
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, tokens_monthly, tokens_added')
    .eq('auth_id', authId);
  
  if (findError || !users || users.length === 0) {
    throw new Error('User not found');
  }
  
  const user = users[0];
  
  // Per TOKEN_TRACKING.md: On cancel, set tokens_monthly to 0, keep tokens_added
  const updateData = {
    tier_id: null,
    subscription_status: 'canceled',
    stripe_subscription_id: null,
    subscription_end_date: null,
    next_billing_date: null,
    tokens_monthly: 0
  };
  
  const { error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id);
  
  if (updateError) throw new Error(`Failed to update user: ${updateError.message}`);
  
  // Return updated user data
  const { data: updatedUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { success: true, user: updatedUser, applied: updateData };
}

/**
 * DEV ONLY: Simulate subscription created
 * POST /api/dev/stripe/simulate-subscription-created
 * Body: { authId, tierId }
 */
app.post('/api/dev/stripe/simulate-subscription-created', async (req, res) => {
  console.log('[DEV] Simulating subscription created');
  try {
    const { authId, tierId } = req.body;
    
    if (!authId || !tierId) {
      return res.status(400).json({ error: 'authId and tierId are required' });
    }
    
    const result = await applySubscriptionCreated(authId, Number(tierId));
    console.log('[DEV] Subscription created simulation result:', result);
    res.json(result);
  } catch (error) {
    console.error('[DEV] Simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEV ONLY: Simulate subscription renewed
 * POST /api/dev/stripe/simulate-subscription-renewed
 * Body: { authId, tierId }
 */
app.post('/api/dev/stripe/simulate-subscription-renewed', async (req, res) => {
  console.log('[DEV] Simulating subscription renewed');
  try {
    const { authId, tierId } = req.body;
    
    if (!authId || !tierId) {
      return res.status(400).json({ error: 'authId and tierId are required' });
    }
    
    const result = await applySubscriptionRenewed(authId, Number(tierId));
    console.log('[DEV] Subscription renewed simulation result:', result);
    res.json(result);
  } catch (error) {
    console.error('[DEV] Simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEV ONLY: Simulate subscription canceled
 * POST /api/dev/stripe/simulate-subscription-canceled
 * Body: { authId }
 */
app.post('/api/dev/stripe/simulate-subscription-canceled', async (req, res) => {
  console.log('[DEV] Simulating subscription canceled');
  try {
    const { authId } = req.body;
    
    if (!authId) {
      return res.status(400).json({ error: 'authId is required' });
    }
    
    const result = await applySubscriptionCanceled(authId);
    console.log('[DEV] Subscription canceled simulation result:', result);
    res.json(result);
  } catch (error) {
    console.error('[DEV] Simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEV ONLY: Set user tokens directly for testing
 * POST /api/dev/set-tokens
 * Body: { authId, tokens_monthly, tokens_added, tokens_used, tokens_used_all_time }
 */
app.post('/api/dev/set-tokens', async (req, res) => {
  console.log('[DEV] Setting user tokens directly');
  try {
    const { authId, tokens_monthly, tokens_added, tokens_used, tokens_used_all_time } = req.body;
    
    if (!authId) {
      return res.status(400).json({ error: 'authId is required' });
    }
    
    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }
    
    const updateData = {};
    if (tokens_monthly !== undefined) updateData.tokens_monthly = Number(tokens_monthly);
    if (tokens_added !== undefined) updateData.tokens_added = Number(tokens_added);
    if (tokens_used !== undefined) updateData.tokens_used = Number(tokens_used);
    if (tokens_used_all_time !== undefined) updateData.tokens_used_all_time = Number(tokens_used_all_time);
    
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('auth_id', authId);
    
    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }
    
    const { data: updatedUser } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();
    
    console.log('[DEV] User tokens set:', updatedUser);
    res.json({ success: true, user: updatedUser, applied: updateData });
  } catch (error) {
    console.error('[DEV] Set tokens error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DEV ONLY: Burn tokens for a user using the standard token tracking model
 * POST /api/dev/burn-tokens
 * Body: { anonId, authId, amount }
 */
app.post('/api/dev/burn-tokens', async (req, res) => {
  console.log('[DEV] Burning tokens for user');
  try {
    const { anonId, authId, amount } = req.body || {};

    console.log('[DEV] /api/dev/burn-tokens request body:', {
      anonId,
      authId,
      amount,
    });

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const burnAmount = Number(amount) || 0;
    if (!anonId && !authId) {
      return res.status(400).json({ error: 'anonId or authId is required' });
    }
    if (burnAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    let query = supabase
      .from('users')
      .select('id, tokens_monthly, tokens_added, tokens_used, tokens_used_all_time, tier_id');

    if (authId) {
      query = query.eq('auth_id', authId);
    } else {
      query = query.eq('anon_id', anonId);
    }

    const { data: users, error: userError } = await query;

    if (userError || !users || users.length === 0) {
      return res.status(404).json({ error: userError?.message || 'User not found' });
    }

    const user = users[0];

    const burnResult = await updateUserTokens(user.id, burnAmount, 'Dev burn tokens');
    if (!burnResult.success) {
      return res.status(400).json({ error: burnResult.error || 'Failed to burn tokens' });
    }

    const { data: updatedUsers, error: updatedError } = await supabase
      .from('users')
      .select('tokens_monthly, tokens_used, tokens_added, tokens_used_all_time, tier_id')
      .eq('id', user.id);

    if (updatedError || !updatedUsers || updatedUsers.length === 0) {
      return res.status(500).json({ error: updatedError?.message || 'Failed to fetch updated user' });
    }

    const updatedUser = updatedUsers[0];
    const tokensMonthly = Number(updatedUser.tokens_monthly) || 0;
    const tokensAdded = Number(updatedUser.tokens_added) || 0;
    const tokensUsed = Number(updatedUser.tokens_used) || 0;
    const tokensUsedAllTime = Number(updatedUser.tokens_used_all_time) || 0;
    const availableTokens = Math.max(0, tokensMonthly + tokensAdded);

    const responseData = {
      tokens_monthly: tokensMonthly,
      tokens_used: tokensUsed,
      tokens_added: tokensAdded,
      tokens_used_all_time: tokensUsedAllTime,
      availableTokens,
      tier_id: updatedUser.tier_id || null,
      burned: burnAmount
    };

    console.log('[DEV] /api/dev/burn-tokens response data:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('[DEV] Burn tokens error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`ScribeFold AI Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`DeepSeek endpoint: http://localhost:${PORT}/api/deepseek/query`);
  console.log(`User initialize: http://localhost:${PORT}/api/user/initialize`);
  console.log(`User tokens: http://localhost:${PORT}/api/user/tokens/:userId`);
  console.log(`User ensure: http://localhost:${PORT}/api/users/ensure`);
  console.log(`Stripe sync: http://localhost:${PORT}/api/stripe/sync`);
  console.log(`DeepSeek API Key configured: ${!!process.env.DEEPSEEK_API_KEY}`);
  console.log(`Supabase configured: ${!!supabase}`);
  console.log(`Stripe configured: ${!!stripe}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (encoder) {
    encoder.free();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  if (encoder) {
    encoder.free();
  }
  process.exit(0);
});
