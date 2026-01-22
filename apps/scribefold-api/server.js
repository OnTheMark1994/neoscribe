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
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const { PROMPT_PREFACE } = require('./constants');

const app = express();
// Default to 8080 because the editor currently targets http://localhost:8080.
// You can override via PORT in the environment if needed.
const PORT = process.env.PORT || 8080;

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠ Supabase not configured. Auth endpoints will be disabled.');
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Email confirmation settings
const EMAIL_CONFIRM_SECRET = process.env.EMAIL_CONFIRM_SECRET || 'fallback-secret-change-me';
const EMAIL_CONFIRM_EXPIRY = '24h';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Allow local dev clients (React app) to call this server.
app.use(cors());

// Parse JSON request bodies.
app.use(express.json({ limit: '2mb' }));

/**
 * Lightweight health endpoint.
 * Useful for quickly confirming the server is running.
 */
app.get('/', (req, res) => {
  res.status(200).send('ok');
});

/**
 * Calls DeepSeek's Chat Completions API.
 *
 * Why a helper:
 * - Keeps endpoint handler small.
 * - Makes it easier to reuse if we add more routes later.
 */
async function callDeepSeekChatCompletions({ messages, model = 'deepseek-chat', temperature = 0.7 }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    // Clear, actionable error so setup is straightforward.
    throw new Error('DEEPSEEK_API_KEY is missing. Add it to your environment (.env) before starting the server.');
  }

  const requestBody = {
    model,
    messages,
    stream: false,
    temperature,
  };

  // Node 18+ has fetch built-in. If you're on an older Node, upgrade to 18+.
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `DeepSeek API error: ${response.status} ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    err.details = errorData;
    throw err;
  }

  return response.json();
}

/**
 * Generate a signed JWT token for email confirmation
 * Contains email and password so the web-portal can auto-login the user after confirmation
 */
function generateConfirmationToken(userId, email, password) {
  return jwt.sign(
    { userId, email, password },
    EMAIL_CONFIRM_SECRET,
    { expiresIn: EMAIL_CONFIRM_EXPIRY }
  );
}

/**
 * Verify and decode a confirmation token
 */
function verifyConfirmationToken(token) {
  try {
    const decoded = jwt.verify(token, EMAIL_CONFIRM_SECRET);
    return decoded;
  } catch (err) {
    console.error('[verifyConfirmationToken] Invalid or expired token:', err.message);
    return null;
  }
}

/**
 * POST /auth/create-account
 *
 * Creates a Supabase auth user and signs them in.
 *
 * Input: { email, password }
 * Output: { success, message, user, session }
 */
app.post('/auth/create-account', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log('[create-account] Creating account for email:', email);

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for testing
    });

    if (authError) {
      console.error('❌ Failed to create auth user:', authError);
      
      let errorMessage = authError.message || 'Failed to create auth user';
      
      if (authError.name === 'AuthRetryableFetchError' || authError.message?.includes('fetch failed')) {
        errorMessage = 'Cannot connect to Supabase. Please check your SUPABASE_URL and network connection.';
      }
      
      return res.status(500).json({
        success: false,
        error: errorMessage,
        details: authError
      });
    }

    // Sign in to get session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('❌ Failed to sign in after account creation:', signInError);
      // Account created but sign in failed - return user anyway
      return res.json({
        success: true,
        message: 'Account created but sign in failed. Please try logging in manually.',
        messageType: 'warning',
        user: authData.user,
        session: null
      });
    }

    console.log('✓ Create-account completed');

    return res.json({
      success: true,
      message: 'Account created! Please check your email to collect 15,000 free tokens the click refresh here.',
      messageType: 'success',
      user: signInData.user,
      session: signInData.session
    });
  } catch (error) {
    console.error('Error in /auth/create-account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
      details: error.message
    });
  }
});

/**
 * POST /auth/login
 *
 * Logs in an existing user using Supabase auth.
 *
 * Input: { email, password }
 * Output: { success, message, user? }
 */
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log('[login] Logging in email:', email);

    // Sign in with Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Failed to login:', error);
      
      let errorMessage = error.message || 'Invalid email or password';
      
      if (error.name === 'AuthRetryableFetchError' || error.message?.includes('fetch failed')) {
        errorMessage = 'Cannot connect to Supabase. Please check your SUPABASE_URL and network connection.';
      }
      
      return res.status(401).json({
        success: false,
        error: errorMessage,
        details: error
      });
    }

    console.log('✓ Login successful for user:', data.user?.id);

    return res.json({
      success: true,
      message: 'Login successful',
      messageType: 'success',
      user: data.user,
      session: data.session
    });
  } catch (error) {
    console.error('Error in /auth/login:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
      details: error.message
    });
  }
});

/**
 * POST /chat
 *
 * Contract:
 * - Input: { prompt: string }
 * - Output: { text: string }
 *
 * This keeps the editor-side integration simple: send the textbox content,
 * get back the model response text.
 */
app.post('/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

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

    return res.status(200).json({
      success: true,
      text,
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
  console.log(`scribefold-api listening on http://localhost:${PORT}`);
  console.log(`GET  /            -> health (returns ok)`);
  console.log(`POST /chat        -> DeepSeek proxy (requires DEEPSEEK_API_KEY env var)`);
  console.log(`POST /auth/create-account -> Create account`);
  console.log(`POST /auth/login   -> Login with email and password`);
});

// If the process can't bind the port (already in use, permissions, etc), show a clear error.
server.on('error', (err) => {
  console.error('[scribefold-api] Failed to start server:', err?.message || err);
  if (String(err?.code || '').toUpperCase() === 'EADDRINUSE') {
    console.error(`[scribefold-api] Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
  }
});
