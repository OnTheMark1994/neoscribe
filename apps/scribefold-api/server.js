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

const { PROMPT_PREFACE } = require('./constants');
const { calculateAvailableTokens, estimateTokensUsed, updateUserTokens } = require('./functions');

const app = express();
// Default to 8080 because the editor currently targets http://localhost:8080.
// You can override via PORT in the environment if needed.
const PORT = process.env.PORT || 8080;

// Token grant amount
const FREE_TOKENS_GRANT = 15000;

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY_SECRET;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠ Supabase not configured. Auth endpoints will be disabled.');
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Email confirmation settings
const EMAIL_CONFIRM_SECRET = process.env.EMAIL_CONFIRM_SECRET || 'fallback-secret-change-me';
const EMAIL_CONFIRM_EXPIRY = '24h';
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || 'https://scribefold-ai-monorepo.onrender.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'ScribeFold AI <onboarding@resend.dev>';

// Encryption utilities for session_builders table
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

// Validate and log encryption key
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
console.log('========================================');
console.log('ENCRYPTION KEY VALIDATION:');
console.log('Key length (chars):', ENCRYPTION_KEY.length);
console.log('Key buffer length (bytes):', keyBuffer.length);
console.log('Expected: 64 chars, 32 bytes for AES-256');
console.log('Valid:', keyBuffer.length === 32);
console.log('========================================');

// Use fixed IV for deterministic encryption (same input = same output)
const FIXED_IV = Buffer.alloc(IV_LENGTH, 0);

const encrypt = (text) => {
  console.log('[ENC MAGIC LINK] ENCRYPT - Input length:', text.length);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, FIXED_IV);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const result = encrypted.toString('hex');
  console.log('[ENC MAGIC LINK] ENCRYPT - Output length:', result.length, 'prefix:', result.substring(0, 20) + '...');
  return result;
};

const decrypt = (text) => {
  console.log('[ENC MAGIC LINK] DECRYPT - Input length:', text.length, 'prefix:', text.substring(0, 20) + '...');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, FIXED_IV);
  const result = Buffer.concat([
    decipher.update(Buffer.from(text, 'hex')),
    decipher.final()
  ]).toString();
  console.log('[ENC MAGIC LINK] DECRYPT - Output length:', result.length);
  return result;
};

// Initialize Resend client for email
let resend = null;
if (process.env.RESEND_KEY) {
  resend = new Resend(process.env.RESEND_KEY);
  console.log('✓ Resend client initialized');
} else {
  console.warn('⚠ Resend not configured - email sending disabled');
}

// Allow web portal and local dev clients to call this server
app.use(cors({
  origin: [
    'http://localhost:3001', // Web portal local dev
    'http://localhost:3000', // Web portal local dev (alternate port)
    'https://scribefold-ai-monorepo.onrender.com', // Web portal prod
    'http://localhost:8080', // API local dev
  ],
  credentials: true
}));

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
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Generate a random unique token for claiming free tokens
 * @returns {string} - Random token string
 */
function generateUniqueToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
 * Send confirmation email via Resend
 * @param {string} toEmail - Recipient email
 * @param {string} confirmUrl - Full confirmation URL
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendConfirmationEmail(toEmail, confirmUrl) {
  if (!resend) {
    console.warn('[sendConfirmationEmail] Resend not configured, skipping email. Confirm URL:', confirmUrl);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: 'Confirm your ScribeFold AI account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to ScribeFold AI!</h1>
          <p>Thank you for creating an account. Please confirm your email address to receive your free tokens.</p>
          <p style="margin: 24px 0;">
            <a href="${confirmUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Confirm Email
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">${confirmUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">This link expires in 24 hours.</p>
        </div>
      `
    });

    if (error) {
      console.error('[sendConfirmationEmail] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('[sendConfirmationEmail] Email sent successfully, id:', data?.id);
    return { success: true };
  } catch (err) {
    console.error('[sendConfirmationEmail] Exception:', err);
    return { success: false, error: err.message };
  }
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
      email_confirm: true, // Auto-confirm so user can sign in immediately
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

    // Generate unique token for claiming free tokens
    const claimToken = generateUniqueToken();
    
    // Store claim token in users table
    try {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          claim_token: claimToken,
          email: email,
        });

      if (insertError) {
        console.error('[create-account] Failed to store claim token:', insertError);
        throw insertError;
      }

      console.log('[create-account] Stored claim token for user:', authData.user.id);
    } catch (dbError) {
      console.error('[create-account] Failed to store claim token:', dbError);
      // Continue anyway - user can request a new token
    }
    
    // Build confirmation URL with claim token
    const confirmUrl = `${WEB_PORTAL_URL}/#/confirm?token=${encodeURIComponent(claimToken)}`;
    console.log('[create-account] Confirmation URL:', confirmUrl);

    // Send confirmation email (for claiming free tokens)
    const emailResult = await sendConfirmationEmail(email, confirmUrl);
    
    if (!emailResult.success) {
      console.warn('[create-account] Failed to send confirmation email:', emailResult.error);
      // Don't fail the request - account is created and signed in, user can request resend
    }

    console.log('✓ Create-account completed');

    return res.json({
      success: true,
      message: 'Account created! Please check your email to claim 15,000 free tokens.',
      messageType: 'success',
      user: authData.user,
      session: authData.session,
      emailSent: emailResult.success,
      // Include confirmUrl in response for dev/testing when Resend is not configured
      ...(resend ? {} : { confirmationUrl: confirmUrl })
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
    const userId = body.userId; // auth_id from Supabase

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

      const { data: user, error: fetchError } = await supabase
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
      const { error: updateError } = await supabase
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

/**
 * POST /auth/claim-tokens
 *
 * Claims free tokens using a unique token
 * Looks up user by token, adds tokens, clears token
 * Returns user credentials for auto-login
 *
 * Input: { token }
 * Output: { success, message, tokensAdded, email?, password?, error? }
 */
app.post('/auth/claim-tokens', async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    console.log('[claim-tokens] Looking up user by token:', token);

    // Find user by confirmation token
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('claim_token', token)
      .single();

    if (fetchError || !user) {
      console.error('[claim-tokens] Invalid or expired token');
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token. Please request a new confirmation email.'
      });
    }

    console.log('[claim-tokens] Found user:', user.id);

    // Check if tokens already claimed (claim_token is null)
    if (!user.claim_token) {
      console.log('[claim-tokens] Token already used for user:', user.id);
      return res.status(400).json({
        success: false,
        error: 'This confirmation link has already been used. Tokens have already been added to your account.'
      });
    }

    // Add tokens to user
    const newTokensAdded = (Number(user.tokens_added) || 0) + FREE_TOKENS_GRANT;
    const { error: updateError } = await supabase
      .from('users')
      .update({
        tokens_added: newTokensAdded,
        claim_token: null // Clear the token after claiming
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[claim-tokens] Failed to update user:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to add tokens'
      });
    }

    console.log('[claim-tokens] Successfully added tokens to user:', user.id);

    // Try to log the user in using stored password
    let sessionData = null;
    try {
      console.log('[claim-tokens] Attempting to log user in...');

      const email = user.email;
      const password = user.password;

      console.log('[claim-tokens] User email:', email);
      console.log('[claim-tokens] User has password in DB:', !!password);

      if (email && password) {
        console.log('[claim-tokens] Calling signInWithPassword...');

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        console.log('[claim-tokens] signInWithPassword result:', {
          hasError: !!signInError,
          errorMessage: signInError?.message,
          hasSession: !!signInData?.session,
          hasAccessToken: !!signInData?.session?.access_token,
          hasRefreshToken: !!signInData?.session?.refresh_token
        });

        if (!signInError && signInData?.session) {
          sessionData = {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token
          };
          console.log('[claim-tokens] ✓ User logged in successfully');
        } else {
          console.warn('[claim-tokens] ✗ Could not log user in:', signInError?.message);
        }
      } else {
        console.warn('[claim-tokens] ✗ Cannot log in - missing email or password');
      }
    } catch (sessionErr) {
      console.error('[claim-tokens] ✗ Exception logging user in:', sessionErr.message);
    }

    console.log('[claim-tokens] Session data to return:', {
      hasSessionData: !!sessionData,
      hasAccessToken: !!sessionData?.access_token,
      hasRefreshToken: !!sessionData?.refresh_token
    });

    // Get auth user email
    const { data: authUser } = await supabase.auth.admin.getUserById(user.auth_id);

    return res.json({
      success: true,
      message: `Successfully added ${FREE_TOKENS_GRANT.toLocaleString()} free tokens to your account!`,
      tokensAdded: FREE_TOKENS_GRANT,
      totalTokens: newTokensAdded,
      email: authUser?.user?.email || null,
      userId: user.auth_id,
      sessionData: sessionData // May be null, but tokens were still granted
    });
  } catch (error) {
    console.error('Error in /auth/claim-tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim tokens',
      details: error.message
    });
  }
});

/**
 * POST /auth/send-token-email
 *
 * Sends a confirmation email with token for an existing user
 * Used for testing without creating a new user
 *
 * Input: { userId }
 * Output: { success, message, confirmUrl?, error? }
 */
app.post('/auth/send-token-email', async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log('[send-token-email] Sending token email for user:', userId);

    // Find user by auth_id
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single();

    if (fetchError || !user) {
      console.error('[send-token-email] User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get auth user email
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;

    if (!email) {
      console.error('[send-token-email] Auth user not found');
      return res.status(404).json({
        success: false,
        error: 'Auth user not found'
      });
    }

    // Generate new claim token
    const claimToken = generateUniqueToken();

    // Update user with new confirmation token
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        claim_token: claimToken
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[send-token-email] Failed to update user:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate claim token'
      });
    }

    // Build confirmation URL
    const confirmUrl = `${WEB_PORTAL_URL}/#/confirm?token=${encodeURIComponent(claimToken)}`;
    console.log('[send-token-email] Confirmation URL:', confirmUrl);

    // Send confirmation email
    const emailResult = await sendConfirmationEmail(email, confirmUrl);

    if (!emailResult.success) {
      console.warn('[send-token-email] Failed to send email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send email'
      });
    }

    console.log('[send-token-email] Token email sent successfully');

    return res.json({
      success: true,
      message: `Token email sent to ${email}`,
      email: email,
      confirmUrl: confirmUrl
    });
  } catch (error) {
    console.error('Error in /auth/send-token-email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send token email',
      details: error.message
    });
  }
});

/**
 * POST /auth/user-data
 *
 * Returns user data from the database including tokens
 *
 * Input: { userId }
 * Output: { success, userData, error? }
 */
app.post('/auth/user-data', async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log('[user-data] Fetching user data for:', userId);

    // Find user by auth_id
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single();

    if (fetchError || !user) {
      console.error('[user-data] User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('[user-data] User data found:', {
      id: user.id,
      auth_id: user.auth_id,
      tokens_added: user.tokens_added,
      tokens_monthly: user.tokens_monthly,
      tokens_used_this_month: user.tokens_used_this_month,
      tokens_used_all_time: user.tokens_used_all_time
    });

    // Calculate available tokens using helper function
    const availableTokens = calculateAvailableTokens(user);

    console.log('[user-data] Available tokens:', availableTokens);

    return res.json({
      success: true,
      userData: {
        id: user.id,
        auth_id: user.auth_id,
        email: user.email,
        tokens: availableTokens, // Calculated available tokens
        tokens_added: user.tokens_added || 0,
        tokens_monthly: user.tokens_monthly || 0,
        tokens_used_this_month: user.tokens_used_this_month || 0,
        tokens_used_all_time: user.tokens_used_all_time || 0,
      }
    });
  } catch (error) {
    console.error('Error in /auth/user-data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
      details: error.message
    });
  }
});

/**
 * POST /auth/token-login
 *
 * Validates a login token and returns auth credentials
 *
 * Input: { token }
 * Output: { success, user, session, error? }
 */
app.post('/auth/token-login', async (req, res) => {
  console.log("in /auth/token-login")
  try {
    const { token } = req.body || {};

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    console.log('[token-login] Validating token:', token);

    // Find user by login token
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('login_token', token)
      .single();

    if (fetchError || !user) {
      console.error('[token-login] Invalid token');
      return res.status(401).json({
        success: false,
        error: 'Invalid login token'
      });
    }

    console.log('[token-login] Found user:', user.id);

    // Get auth user email
    const { data: authUser } = await supabase.auth.admin.getUserById(user.auth_id);
    if (!authUser?.user?.email) {
      console.error('[token-login] Auth user not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const email = authUser.user.email;
    const password = user.password;

    if (!password) {
      console.error('[token-login] No password stored for user');
      return res.status(500).json({
        success: false,
        error: 'Password not found'
      });
    }

    // Sign in with Supabase auth using stored password
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    console.log("token login signInData: ", signInData)

    if (signInError) {
      console.error('[token-login] Failed to sign in:', signInError);
      return res.status(500).json({
        success: false,
        error: 'Failed to authenticate'
      });
    }

    console.log('[token-login] User authenticated successfully');

    // Clear the token after successful login
    await supabase
      .from('users')
      .update({ login_token: null })
      .eq('id', user.id);

    return res.json({
      success: true,
      user: signInData.user,
      session: signInData.session
    });
  } catch (error) {
    console.error('Error in /auth/token-login:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login with token',
      details: error.message
    });
  }
});

// New secure auto-login endpoints using custom JWT

/**
 * POST /api/generate-login-code
 * Validates user's access token and generates a one-time login code
 * Input: Authorization header with Bearer token
 * Output: { login_code }
 */
app.post('/api/generate-login-token', async (req, res) => {
  try {
    console.log('[generate-login-token] Incoming headers Authorization exists:', !!req.headers.authorization);
    console.log('[generate-login-token] Raw Authorization header prefix:', req.headers.authorization?.substring(0, 20) + '...');
    const userAccessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!userAccessToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    console.log('[generate-login-token] Validating user token...');
    console.log('[generate-login-token] Token length:', userAccessToken.length);
    console.log('[generate-login-token] Token prefix:', userAccessToken.substring(0, 20) + '...');

    // Validate: Verify JWT locally and extract user id (sub)
    let decoded;
    try {
      decoded = jwt.verify(userAccessToken, process.env.SUPABASE_JWT_SECRET);
    } catch (e) {
      console.error('[generate-login-token] JWT verify failed:', e?.message);
      return res.status(401).json({ error: 'Invalid token', details: e?.message });
    }

    const authUserId = decoded?.sub;
    console.log('[generate-login-token] User token verified. sub:', authUserId);

    // Get user's row in public.users table
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUserId)
      .single();

    if (fetchError || !userData) {
      console.error('[generate-login-token] User not found in users table. Error:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Create: Generate a secure, one-time token
    const loginToken = crypto.randomBytes(32).toString('hex');

    // Store: Save token in the user's row
    const { error: updateError } = await supabase
      .from('users')
      .update({
        login_token: loginToken
      })
      .eq('id', userData.id);

    if (updateError) {
      console.error('[generate-login-token] Failed to store login token:', updateError);
      return res.status(500).json({ error: 'Failed to generate login token' });
    }

    console.log('[generate-login-token] Login token generated for user:', userData.id, 'prefix:', loginToken.substring(0, 10) + '...');

    res.json({ token: loginToken });
  } catch (error) {
    console.error('[generate-login-token] Exception:', { message: error?.message, stack: error?.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/verify-login-code
 * Verifies login code and creates custom JWT for auto-login
 * Input: { code }
 * Output: { access_token }
 */
app.post('/api/verify-login-code', async (req, res) => {
  try {
    const { code } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }

    console.log('[verify-login-code] Verifying code...');

    // Find: Lookup user by the valid code
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('login_token', code)
      .single();

    if (error || !userData) {
      console.error('[verify-login-code] Invalid code:', error);
      return res.status(400).json({ error: 'Invalid code' });
    }

    console.log('[verify-login-code] Found user:', userData.id);

    // Invalidate: Clear the token immediately after use
    await supabase
      .from('users')
      .update({ login_token: null })
      .eq('id', userData.id);

    // Create & Sign: Build and sign the custom JWT
    const payload = {
      aud: 'authenticated',
      role: 'authenticated',
      sub: userData.auth_id, // Use Supabase auth_id
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    };

    const accessToken = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET);

    console.log('[verify-login-code] JWT created for user:', userData.id);

    res.json({ access_token: accessToken });
  } catch (error) {
    console.error('[verify-login-code] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/verify-email-token
 *
 * Verifies email confirmation token, adds free tokens, and creates custom JWT for auto-login
 * Input: { token }
 * Output: { access_token, tokensAdded }
 */
app.post('/api/verify-email-token', async (req, res) => {
  try {
    const { token } = req.body || {};

    console.log('[verify-email-token] Request received');
    console.log('[verify-email-token] Request body:', req.body);
    console.log('[verify-email-token] Token provided:', token ? token.substring(0, 20) + '...' : 'none');

    if (!supabase) {
      console.error('[verify-email-token] Supabase not configured');
      return res.status(503).json({ error: 'Database not configured' });
    }

    if (!token) {
      console.error('[verify-email-token] No token provided');
      return res.status(400).json({ error: 'No token provided' });
    }

    console.log('[verify-email-token] Verifying email token...');

    // Find: Lookup user by claim_token
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, auth_id, claim_token')
      .eq('claim_token', token)
      .single();

    console.log('[verify-email-token] Database query result:', {
      hasError: !!error,
      errorMessage: error?.message,
      hasUserData: !!userData,
      userDataId: userData?.id
    });

    if (error || !userData) {
      console.error('[verify-email-token] Invalid token:', error);
      return res.status(400).json({ error: 'Invalid or expired token. Please request a new confirmation email.' });
    }

    console.log('[verify-email-token] Found user:', userData.id);

    // Check if tokens already claimed (claim_token is null)
    if (!userData.claim_token) {
      console.log('[verify-email-code] Token already used for user:', userData.id);
      return res.status(400).json({
        error: 'This confirmation link has already been used. Tokens have already been added to your account.'
      });
    }

    // Add tokens to user
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('tokens_added')
      .eq('id', userData.id)
      .single();

    if (fetchError) {
      console.error('[verify-email-token] Failed to fetch current tokens:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch current tokens' });
    }

    const newTokensAdded = FREE_TOKENS_GRANT;
    const updatedTokensAdded = (Number(currentUser?.tokens_added) || 0) + newTokensAdded;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        tokens_added: updatedTokensAdded,
        claim_token: null // Clear the token after claiming
      })
      .eq('id', userData.id);

    if (updateError) {
      console.error('[verify-email-code] Failed to update user:', updateError);
      return res.status(500).json({ error: 'Failed to add tokens' });
    }

    console.log('[verify-email-code] Successfully added tokens to user:', userData.id);

    // Create & Sign: Build and sign the custom JWT with 1 month expiration
    const payload = {
      aud: 'authenticated',
      role: 'authenticated',
      sub: userData.auth_id, // Use Supabase auth_id
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days (1 month)
    };

    const accessToken = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET);

    console.log('[verify-email-code] JWT created for user:', userData.id);

    res.json({
      success: true,
      access_token: accessToken,
      tokensAdded: newTokensAdded
    });
  } catch (error) {
    console.error('[verify-email-code] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/create-account-dev
 *
 * Development endpoint: Creates a test account with just an email (no password required)
 * Generates a confirmation token and sends email
 *
 * Input: { email }
 * Output: { success, message, confirmationUrl? }
 */
app.post('/api/create-account-dev', async (req, res) => {
  try {
    const { email } = req.body || {};

    console.log('[create-account-dev] Creating dev account for email:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Generate a random password for Supabase auth (user won't need it)
    const randomPassword = crypto.randomBytes(32).toString('hex');

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error('[create-account-dev] Failed to create auth user:', authError);

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

    // Generate unique token for claiming free tokens
    const claimToken = generateUniqueToken();

    // Store claim token in users table
    try {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          claim_token: claimToken,
          email: email,
        });

      if (insertError) {
        console.error('[create-account-dev] Failed to store claim token:', insertError);
        throw insertError;
      }

      console.log('[create-account-dev] Stored claim token for user:', authData.user.id);
    } catch (dbError) {
      console.error('[create-account-dev] Failed to store claim token:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to store claim token',
        details: dbError.message
      });
    }

    // Build confirmation URL with claim token
    const confirmUrl = `${WEB_PORTAL_URL}/#/confirm?token=${encodeURIComponent(claimToken)}`;
    console.log('[create-account-dev] Confirmation URL:', confirmUrl);

    // Send confirmation email (for claiming free tokens)
    const emailResult = await sendConfirmationEmail(email, confirmUrl);

    if (!emailResult.success) {
      console.warn('[create-account-dev] Failed to send confirmation email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send confirmation email',
        details: emailResult.error
      });
    }

    console.log('[create-account-dev] Dev account created and email sent');

    return res.json({
      success: true,
      message: 'Dev account created! Confirmation email sent.',
      email: email,
      confirmationUrl: confirmUrl
    });
  } catch (error) {
    console.error('[create-account-dev] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dev account',
      details: error.message
    });
  }
});

// ============================================================================
// ENCRYPTED AUTO-LOGIN ENDPOINTS
// ============================================================================

/**
 * POST /api/generate-encrypted-login-token
 * Generates a one-time token, encrypts email and token, saves to session_builders table
 * Input: Authorization header with access token
 * Output: { token }
 */
app.post('/api/generate-encrypted-login-token', async (req, res) => {
  try {
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Starting');
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Incoming headers Authorization exists:', !!req.headers.authorization);
    const userAccessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!userAccessToken) {
      console.log('[ENC MAGIC LINK] GENERATE TOKEN - No access token provided');
      return res.status(401).json({ error: 'No access token provided' });
    }

    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Validating user token...');
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Token length:', userAccessToken.length);

    // Validate: Verify JWT locally and extract user id (sub)
    let decoded;
    try {
      decoded = jwt.verify(userAccessToken, process.env.SUPABASE_JWT_SECRET);
    } catch (e) {
      console.error('[ENC MAGIC LINK] GENERATE TOKEN - JWT verify failed:', e?.message);
      return res.status(401).json({ error: 'Invalid token', details: e?.message });
    }

    const authUserId = decoded?.sub;
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - User token verified. sub:', authUserId);

    // Get user's row in public.users table
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('auth_id', authUserId)
      .single();

    if (fetchError || !userData) {
      console.error('[ENC MAGIC LINK] GENERATE TOKEN - User not found in users table. Error:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[ENC MAGIC LINK] GENERATE TOKEN - User found:', userData.id);

    // Get user email
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userData.auth_id);
    if (userError || !user?.user?.email) {
      console.error('[ENC MAGIC LINK] GENERATE TOKEN - User not found. Error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    const email = user.user.email;
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - User email:', email);

    // Generate a secure, one-time token
    const loginToken = crypto.randomBytes(32).toString('hex');
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Generated token length:', loginToken.length, 'prefix:', loginToken.substring(0, 10) + '...');

    // Encrypt token and email
    const encryptedToken = encrypt(loginToken);
    const encryptedEmail = encrypt(email);

    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Encrypted token stored in field1');
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Encrypted email stored in field2');

    // Save to session_builders table (field1 = encrypted token, field2 = encrypted email)
    const { error: insertError } = await supabase
      .from('session_builders')
      .insert({
        field1: encryptedToken,
        field2: encryptedEmail
      });

    if (insertError) {
      console.error('[ENC MAGIC LINK] GENERATE TOKEN - Failed to save to session_builders:', insertError);
      return res.status(500).json({ error: 'Failed to generate login token' });
    }

    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Saved to session_builders table');
    console.log('[ENC MAGIC LINK] GENERATE TOKEN - Returning plain token to client');

    res.json({ token: loginToken });
  } catch (error) {
    console.error('[ENC MAGIC LINK] GENERATE TOKEN - Exception:', { message: error?.message, stack: error?.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/auto-login-magiclink-enc
 * Validates encrypted token, decrypts email, generates magic link
 * Input: { token }
 * Output: { token_hash, type }
 */
app.post('/auth/auto-login-magiclink-enc', async (req, res) => {
  try {
    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Starting');
    const { token } = req.body || {};
    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Incoming body:', { tokenLength: token?.length, tokenPrefix: token?.slice(0, 10) });

    if (!token) {
      console.log('[ENC MAGIC LINK] VALIDATE TOKEN - No token provided');
      return res.status(400).json({ error: 'No token provided' });
    }

    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Encrypting token for lookup...');
    // Look up in session_builders table by encrypted token
    const encryptedToken = encrypt(token);
    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Encrypted token for lookup, prefix:', encryptedToken.substring(0, 20) + '...');

    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Looking up in session_builders table...');
    const { data: sessionData, error: findError } = await supabase
      .from('session_builders')
      .select('field1, field2')
      .eq('field1', encryptedToken)
      .single();

    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Session lookup:', { found: !!sessionData, error: findError?.message });
    if (findError || !sessionData) {
      console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Invalid or expired token');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Session found, decrypting email...');
    // Decrypt email from field2
    const encryptedEmail = sessionData.field2;
    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Encrypted email prefix:', encryptedEmail.substring(0, 20) + '...');

    const email = decrypt(encryptedEmail);
    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Decrypted email:', email);

    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Deleting session entry...');
    // Delete the session entry after use
    await supabase
      .from('session_builders')
      .delete()
      .eq('field1', encryptedToken);

    console.log('[ENC MAGIC LINK] VALIDATE TOKEN - Session entry deleted');

    console.log('[ENC MAGIC LINK] GENERATE MAGIC LINK - Starting for email:', email);
    // Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: { redirectTo: `${process.env.REACT_APP_URL || 'http://localhost:3001'}/#/account` }
    });

    console.log('[ENC MAGIC LINK] GENERATE MAGIC LINK - Generate link:', { success: !!linkData, error: linkError?.message });
    if (linkError) {
      return res.status(linkError.status || 500).json({ error: linkError.message });
    }

    // Extract token_hash from the action_link
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get('token');
    console.log('[ENC MAGIC LINK] GENERATE MAGIC LINK - Extracted token_hash prefix:', token_hash?.slice(0, 10));

    console.log('[ENC MAGIC LINK] GENERATE MAGIC LINK - Returning token_hash to client');
    res.json({ token_hash, type: 'magiclink' });
  } catch (e) {
    console.error('[ENC MAGIC LINK] VALIDATE TOKEN - Error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// END ENCRYPTED AUTO-LOGIN ENDPOINTS
// ============================================================================

/**
 * POST /auth/auto-login-magiclink
 * Generates magic link server-side and returns token_hash for client verifyOtp
 * Input: { token }
 * Output: { token_hash, type }
 */
app.post('/auth/auto-login-magiclink', async (req, res) => {
  try {
    const { token } = req.body || {};
    console.log('[auto-login-magiclink] Incoming body:', { tokenLength: token?.length, tokenPrefix: token?.slice(0, 10) });

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // Validate token against users.login_token
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('login_token', token)
      .single();

    console.log('[auto-login-magiclink] Token lookup:', { found: !!userData, error: error?.message });
    if (error || !userData) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Invalidate the one-time token
    await supabase
      .from('users')
      .update({ login_token: null })
      .eq('id', userData.id);

    console.log('[auto-login-magiclink] Token invalidated for user:', userData.id);

    // Get user email
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userData.auth_id);
    console.log('[auto-login-magiclink] User fetch:', { email: user?.user?.email, error: userError?.message });
    if (userError || !user?.user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = user.user.email;

    // Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: { redirectTo: `${process.env.REACT_APP_URL || 'http://localhost:3001'}/#/account` }
    });

    console.log('[auto-login-magiclink] Generate link:', { success: !!linkData, error: linkError?.message });
    if (linkError) {
      return res.status(linkError.status || 500).json({ error: linkError.message });
    }

    // Extract token_hash from the action_link
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get('token');
    console.log('[auto-login-magiclink] Extracted token_hash prefix:', token_hash?.slice(0, 10));

    res.json({ token_hash, type: 'magiclink' });
  } catch (e) {
    console.error('[auto-login-magiclink] Error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// END AUTO-LOGIN TESTING ENDPOINTS
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`scribefold-api listening on http://localhost:${PORT}`);
});

// If the process can't bind the port (already in use, permissions, etc), show a clear error.
server.on('error', (err) => {
  console.error('[scribefold-api] Failed to start server:', err?.message || err);
  if (String(err?.code || '').toUpperCase() === 'EADDRINUSE') {
    console.error(`[scribefold-api] Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
  }
});
