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
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || 'https://scribefold-ai-monorepo.onrender.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'ScribeFold AI <onboarding@resend.dev>';

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
          password: password, // Store password for auto-login
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
      user: signInData.user,
      session: signInData.session,
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
          available_tokens: availableTokens
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
      console.log('[claim-tokens] User password length:', password?.length || 0);

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
      .update({ claim_token: claimToken })
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
 * POST /auth/auto-login
 *
 * Generates a Supabase magic link token for auto-login from editor to web portal
 * Returns the token_hash for client-side verification
 */
app.post('/auth/auto-login', async (req, res) => {
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
        error: 'userId is required'
      });
    }

    console.log('[auto-login] Generating token for userId:', userId);

    // Get user's email from Supabase auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser?.user?.email) {
      console.error('[auto-login] Failed to get user email:', authError);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const email = authUser.user.email;
    console.log('[auto-login] User email:', email);

    // Use Supabase admin API to generate a magic link (does NOT send email when called via admin)
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${process.env.WEB_PORTAL_URL || 'http://localhost:3000'}/#/account`
      }
    });

    if (linkError) {
      console.error('[auto-login] Failed to generate magic link:', linkError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate auto-login token'
      });
    }

    console.log('[auto-login] Full data response:', JSON.stringify(data, null, 2));

    // Try to extract token_hash from multiple possible locations
    const tokenHash = data.properties?.hashed_token || 
                      data.properties?.token_hash ||
                      data.properties?.action_link?.match(/token_hash=([^&]+)/)?.[1];

    if (!tokenHash) {
      console.error('[auto-login] No token_hash found in response');
      return res.status(500).json({
        success: false,
        error: 'Failed to generate auto-login token'
      });
    }

    console.log('[auto-login] Magic token generated:', tokenHash);

    // Return the token_hash for the editor to use
    return res.json({
      success: true,
      tokenHash: tokenHash
    });
  } catch (error) {
    console.error('Error in /auth/auto-login:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate auto-login token',
      details: error.message
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
