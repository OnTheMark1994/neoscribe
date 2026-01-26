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

// Set up supabase
const supabase = createClient(process.env.SUPABASE_URL,  process.env.SUPABASE_SERVICE_ROLE_KEY_SECRET)
if (!supabase) console.warn('⚠ Supabase not configured. Auth endpoints will be disabled.');

// Initialize Resend client for email
const resend = new Resend(process.env.RESEND_KEY);

// Encryption utilities for session_builders table, must be 64 hex characters (32 bytes)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
// Create key buffer for encryption/decryption
const keyBuffer = createKeyBuffer(ENCRYPTION_KEY);


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

// Attach dependencies to request object for dev endpoints
app.use('/dev', (req, res, next) => {
  req.supabase = supabase;
  req.resend = resend;
  req.keyBuffer = keyBuffer;
  next();
});

// Use dev endpoints router
const devEndpoints = require('./devEndpoints');
app.use('/dev', devEndpoints);

// Basic server helth function
app.get('/', (req, res) => {
  res.status(200).send('ok');
});

// #region Auth, User Data, Chat

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

    // Send claim token email using the reusable function
    const emailResult = await sendClaimTokenEmail(
      supabase,
      resend,
      email,
      authData.user.id,
      process.env.WEB_PORTAL_URL,
      FREE_TOKENS_GRANT,
      process.env.EMAIL_FROM,
      (text) => encrypt(text, keyBuffer)
    );

    if (!emailResult.success) {
      console.warn('[create-account] Failed to send claim token email:', emailResult.error);
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
      // Include magicLinkUrl in response for dev/testing when Resend is not configured
      ...(resend ? {} : { magicLinkUrl: emailResult.magicLinkUrl })
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

// todo: /data route
// Returns user data such as token counts
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

// Simple chat endpoint
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

// #endregion Auth, User Data, Chat

//#region  AUTO-LOGIN ENDPOINTS

// todo: /auth route
// Creates a token and saves encrypted copy, used for auto login 
app.post('/api/generate-encrypted-login-token', async (req, res) => {
  try {
    const userAccessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!userAccessToken) {
      return res.status(401).json({ error: 'No access token provided' });
    }

    // Validate: Verify JWT locally and extract user id (sub)
    let decoded;
    try {
      decoded = jwt.verify(userAccessToken, process.env.SUPABASE_JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token', details: e?.message });
    }

    const authUserId = decoded?.sub;

    // Get user's row in public.users table
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('auth_id', authUserId)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user email
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userData.auth_id);
    if (userError || !user?.user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = user.user.email;

    // Generate a secure, one-time token
    const loginToken = crypto.randomBytes(32).toString('hex');

    // Encrypt token and email
    const encryptedToken = encrypt(loginToken, keyBuffer);
    const encryptedEmail = encrypt(email, keyBuffer);

    // Save to session_builders table (field1 = encrypted token, field2 = encrypted email)
    const { error: insertError } = await supabase
      .from('session_builders')
      .insert({
        field1: encryptedToken,
        field2: encryptedEmail
      });

    if (insertError) {
      return res.status(500).json({ error: 'Failed to generate login token' });
    }

    res.json({ token: loginToken });
  } catch (error) {
    console.error('[generate-encrypted-login-token] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logs user in given token, verifying, sending back a magic link
app.post('/auth/auto-login-magiclink-enc', async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // Look up in session_builders table by encrypted token
    const encryptedToken = encrypt(token, keyBuffer);
    const { data: sessionRow, error: findError } = await supabase
      .from('session_builders')
      .select('field1, field2')
      .eq('field1', encryptedToken)
      .single();

    if (findError || !sessionRow) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Decrypt email from field2
    const encryptedEmail = sessionRow.field2;
    const email = decrypt(encryptedEmail, keyBuffer);

    // Delete the session entry after use
    await supabase
      .from('session_builders')
      .delete()
      .eq('field1', encryptedToken);

    // Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: { redirectTo: `${process.env.REACT_APP_URL || 'http://localhost:3001'}/#/account` }
    });

    if (linkError) {
      return res.status(linkError.status || 500).json({ error: linkError.message });
    }

    // Extract token_hash from the action_link
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get('token');

    res.json({ token_hash, type: 'magiclink' });
  } catch (e) {
    console.error('[auto-login-magiclink-enc] Error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// todo: /claim route
// Claims free tokens using encrypted claim token created in create-account
app.post('/auth/claim-tokens-encrypted', async (req, res) => {
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

    // Encrypt token to match session_builders.field1
    const encryptedToken = encrypt(token, keyBuffer);

    // Look up in session_builders table
    const { data: sessionRow, error: findError } = await supabase
      .from('session_builders')
      .select('field1, field2')
      .eq('field1', encryptedToken)
      .single();

    if (findError || !sessionRow) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Decrypt email from field2
    const encryptedEmail = sessionRow.field2;
    const email = decrypt(encryptedEmail, keyBuffer);

    // Delete the session entry after use
    await supabase
      .from('session_builders')
      .delete()
      .eq('field1', encryptedToken);

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Add tokens to user
    const newTokensAdded = (Number(user.tokens_added) || 0) + FREE_TOKENS_GRANT;
    const { error: updateError } = await supabase
      .from('users')
      .update({
        tokens_added: newTokensAdded,
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to add tokens'
      });
    }

    // Generate magic link for auto-login
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: { redirectTo: `${process.env.WEB_PORTAL_URL || 'http://localhost:3001'}/#/account` }
    });

    if (linkError) {
      return res.status(linkError.status || 500).json({ error: linkError.message });
    }

    // Extract token_hash from the action_link
    const url = new URL(linkData.properties.action_link);
    const token_hash = url.searchParams.get('token');

    return res.json({
      success: true,
      message: `Successfully added ${FREE_TOKENS_GRANT.toLocaleString()} free tokens to your account!`,
      tokensAdded: FREE_TOKENS_GRANT,
      totalTokens: newTokensAdded,
      token_hash,
      type: 'magiclink',
    });
  } catch (error) {
    console.error('[claim-tokens-encrypted] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim tokens',
      details: error.message
    });
  }
});

//#endregion  AUTO-LOGIN ENDPOINTS


const server = app.listen(PORT, () => {
  console.log(`scribefold-api listening on http://localhost:${PORT}`);
});
