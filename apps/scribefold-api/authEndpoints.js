const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { FREE_TOKENS_GRANT } = require('./constants');
const { calculateAvailableTokens, generateUniqueToken, sendClaimTokenEmail, encrypt } = require('./functions');


// app.post('/auth/create-account', async (req, res) => {
router.post('/create-account', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!req.supabaseAdmin) {
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
    const { data: authData, error: authError } = await req.supabaseAdmin.auth.admin.createUser({
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

    // Send claim token email using the reusable function
    const emailResult = await sendClaimTokenEmail(
      req.supabaseAdmin,
      req.resend,
      email,
      authData.user.id,
      process.env.WEB_PORTAL_URL,
      FREE_TOKENS_GRANT,
      process.env.EMAIL_FROM,
      (text) => encrypt(text, req.keyBuffer)
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
      ...(req.resend ? {} : { magicLinkUrl: emailResult.magicLinkUrl })
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

// app.post('/auth/user-data', async (req, res) => {
router.post('/user-data', async (req, res) => {
  try {
    const userAccessToken = req.headers.authorization?.replace('Bearer ', '');

    console.log('[user-data] Request received');
    console.log('[user-data] Authorization header present:', !!req.headers.authorization);
    console.log('[user-data] Token length:', userAccessToken?.length);

    if (!userAccessToken) {
      console.log('[user-data] No access token provided');
      return res.status(401).json({
        success: false,
        error: 'No access token provided'
      });
    }

    // Validate: Verify JWT locally and extract user id (sub)
    let decoded;
    try {
      console.log('[user-data] Verifying JWT token...');
      decoded = jwt.verify(userAccessToken, process.env.SUPABASE_JWT_SECRET);
      console.log('[user-data] JWT verified successfully, user ID:', decoded?.sub);
    } catch (e) {
      console.error('[user-data] JWT verification failed:', e.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        details: e?.message
      });
    }

    const userId = decoded?.sub;

    if (!userId) {
      console.log('[user-data] No user ID in decoded token');
      return res.status(401).json({
        success: false,
        error: 'Invalid token: no user ID found'
      });
    }

    if (!req.supabaseAdmin) {
      console.log('[user-data] Database not configured');
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    console.log('[user-data] Fetching user data for:', userId);

    // Find user by auth_id using admin client
    const { data: user, error: fetchError } = await req.supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', userId)
      .single();

    if (fetchError || !user) {
      console.error('[user-data] User not found:', fetchError?.message);
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
    console.error('[user-data] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
      details: error.message
    });
  }
});

module.exports = router;
