// Minimal standalone API server used by scribefold-editor during development.
//
// Responsibilities:
// - Expose a simple health route at GET / returning "ok".
// - Expose POST /chat that forwards the user prompt to DeepSeek and returns the
//   response text to the caller.
//
// Design notes:
// - We keep the AI prompt preface in constants.js so it can be reused elsewhere
//   and so server.js stays focused on request/response control flow.
// - We use an env var for the DeepSeek key so secrets are never committed.

/*

  user signs up and confirms email: free tokens
    when not signed in on browser there is a box in the chat area with email and password that says "create & verify" 
    with a little text below saying get x free tokens by clicking link in your email
  user downloads on new device: free tokens
    actually would be way simpler to just have the email one
  sign in with google (can add later tho)

  user creates account
  email sent
  message says please confirm email
  they click the link in the email
  it brings them to web portal conform email and they get a message showing they got the tokesn
  they refresh (or auto update in app (desktop and web) would be better)
  they see their tokens
  they can then use the tokens (used in the api calls)




*/

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

// Importing constants
const { PROMPT_PREFACE, FREE_TOKENS_GRANT } = require('./constants');
// Importing functions
const { calculateAvailableTokens, estimateTokensUsed, updateUserTokens, createKeyBuffer, encrypt, decrypt, generateUniqueToken, sendClaimTokenEmail, callDeepSeekChatCompletions } = require('./functions');

// App and port
const app = express();
const PORT = process.env.PORT || 8080;

console.log("process.env.SUPABASE_URL: ", process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 10):"not found")
console.log("process.env.SUPABASE_SERVICE_ROLE_KEY_SECRET: ", process.env.SUPABASE_SERVICE_ROLE_KEY_SECRET ? process.env.SUPABASE_SERVICE_ROLE_KEY_SECRET.substring(0, 5):"not found")
// Set up Supabase clients
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY_SECRET
);
if (!supabaseAdmin) console.warn('⚠ Supabase admin not configured. Auth endpoints will be disabled.');

// Initialize Resend client for email
const resend = new Resend(process.env.RESEND_KEY);

// (todo: maybe cycle this) Encryption utilities for session_builders table, must be 64 hex characters (32 bytes)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
// Create key buffer for encryption/decryption
const keyBuffer = createKeyBuffer(ENCRYPTION_KEY);

// Allow web portal and local dev clients to call this server
app.use(cors({
  origin: [
    'https://scribefold-editor.onrender.com', // Editor prod
    'https://scribefold-ai-monorepo.onrender.com', // Web portal prod
    'http://localhost:3000', // Editor local dev
    'http://localhost:3001', // Web portal local dev
    'http://localhost:8080' // API local dev
  ],
  credentials: true
}));

// Capture raw body for Stripe webhook signature verification
app.use('/s/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  next();
});

// Parse JSON request bodies (except for webhook endpoint)
app.use((req, res, next) => {
  if (req.path === '/s/webhook') {
    next();
  } else {
    express.json({ limit: '2mb' })(req, res, next);
  }
});

// Attach dependencies to request object for endpoints
app.use('/dev', (req, res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  req.resend = resend;
  req.keyBuffer = keyBuffer;
  next();
});
app.use('/auth', (req, res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  req.resend = resend;
  req.keyBuffer = keyBuffer;
  next();
});
app.use('/auto', (req, res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  req.resend = resend;
  req.keyBuffer = keyBuffer;
  next();
});
app.use('/s', (req, res, next) => {
  req.supabaseAdmin = supabaseAdmin;
  req.resend = resend;
  req.keyBuffer = keyBuffer;
  next();
});

// Use dev endpoints router
const devEndpoints = require('./devEndpoints');
app.use('/dev', devEndpoints);

// Use auth endpoints router
const authEndpoints = require('./authEndpoints');
app.use('/auth', authEndpoints);

// Use auto endpoints router
const autoEndpoints = require('./autoEndpoints');
app.use('/auto', autoEndpoints);

// Use Stripe endpoints router
const sEndpoints = require('./sEndpoints');
app.use('/s', sEndpoints);

// Use Stripe checkout router
const sCheckout = require('./sCheckout');
app.use('/s', sCheckout);

// Use health endpoints router
const healthEndpoints = require('./healthEndpoints');
app.use('/', healthEndpoints);

// Use releases endpoints router
const dataEndpoints = require('./dataEndpoints');
app.use('/data', dataEndpoints);

// Serve static files from public folder (must be after custom routes)
app.use(express.static('public'));

// Serve images folder
app.use('/images', express.static('images'));

// Simple chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    // Verify JWT token from Authorization header
    const userAccessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!userAccessToken) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(userAccessToken, process.env.SUPABASE_JWT_SECRET);
    } catch (e) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    const userId = decoded?.sub; // auth_id from JWT token

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token: no user ID found'
      });
    }

    // Backwards compatible input:
    // - Preferred: { messages: [{ role, content }, ...] }
    // - Also allowed: { messages: [...], prompt: "..." } (prompt is appended as the last user message)
    // - Legacy: { prompt: "..." } (works by appending a single user message)
    if (prompt) {
      incomingMessages.push({ role: 'user', content: prompt });
    }

    if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Expected JSON body with at least one message. Example: { "messages": [{"role":"user","content":"..."}] }',
      });
    }

    // Load user data if userId is provided
    let userData = null;
    let availableTokens = 0;

    if (userId) {
      console.log('[chat] Loading user data for:', userId);

      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('auth_id', userId)
        .single();

      if (!fetchError && user) {
        userData = user;
        availableTokens = calculateAvailableTokens(user);

        console.log('[chat] User data loaded:', {
          tokens_added: user.tokens_added,
          tokens_monthly: user.tokens_monthly,
          tokens_used_this_month: user.tokens_used_this_month,
          tokens_used_all_time: user.tokens_used_all_time
        });

        // If no tokens available, return error
        if (availableTokens <= 0) {
          return res.status(200).json({
            success: false,
            error: 'No tokens available. Please get more tokens to continue using the AI.',
            availableTokens: 0,
          });
        }
      } else {
        console.warn('[chat] User not found:', fetchError?.message);
        return res.status(200).json({
          success: false,
          error: 'User not found.',
        });
      }
    }else{
      return res.status(200).json({
        success: false,
        error: 'User ID is required.',
      });
    }

    // Always include the system preface.
    const messages = [
      { role: 'system', content: PROMPT_PREFACE },
      // The client is responsible for sending valid message objects.
      // We keep this intentionally simple and forward them as-is.
      ...incomingMessages,
    ];

    const requestBody = {
      model: 'deepseek-chat',
      messages,
      stream: false,
      temperature: 0.7,
    };

    const apiResponse = await callDeepSeekChatCompletions({
      messages: requestBody.messages,
      model: requestBody.model,
      temperature: requestBody.temperature,
    });

    const text = apiResponse?.choices?.[0]?.message?.content || '';

    // Calculate and update tokens if user data exists
    let newAvailableTokens = availableTokens;
    if (userData && availableTokens > 0) {
      // Estimate tokens used
      const estimatedTokensUsed = estimateTokensUsed(incomingMessages, text);

      console.log('[chat] Estimated tokens used:', estimatedTokensUsed);

      // Calculate new token values (deducts from monthly first, then added)
      const updatedTokens = updateUserTokens(userData, estimatedTokensUsed);

      console.log('[chat] Updating user tokens:', {
        new_tokens_monthly: updatedTokens.tokens_monthly,
        new_tokens_added: updatedTokens.tokens_added,
        new_tokens_used_this_month: updatedTokens.tokens_used_this_month,
        new_tokens_used_all_time: updatedTokens.tokens_used_all_time,
        new_available_tokens: updatedTokens.available_tokens
      });

      // Update user data
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          tokens_monthly: updatedTokens.tokens_monthly,
          tokens_added: updatedTokens.tokens_added,
          tokens_used_this_month: updatedTokens.tokens_used_this_month,
          tokens_used_all_time: updatedTokens.tokens_used_all_time,
        })
        .eq('id', userData.id);

      if (updateError) {
        console.error('[chat] Failed to update user tokens:', updateError);
      }

      newAvailableTokens = updatedTokens.available_tokens;
    }

    return res.status(200).json({
      success: true,
      text,
      availableTokens: newAvailableTokens,
    });
  } catch (error) {
    console.error('[POST /chat] Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown server error',
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`scribefold-api listening on ${PORT}`);
});
