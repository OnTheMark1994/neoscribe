
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
 * POST /api/generate-encrypted-login-token
 * Generates a one-time token, encrypts email and token, saves to session_builders table
 * Also generates claim_token for token claiming flow
 * Used by: Test Encrypted Magic Link button and "Get More Tokens" button
 * Input: Authorization header with access token
 * Output: { token }
 */
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
    const encryptedToken = encrypt(loginToken);
    const encryptedEmail = encrypt(email);

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

/**
 * POST /auth/send-magiclink-email
 * Sends an encrypted magic link email for testing the token claiming flow
 * Uses the same sendClaimTokenEmail function as create-account endpoint
 * Input: { userId }
 * Output: { success, message, magicLinkUrl?, error? }
 */
app.post('/auth/send-magiclink-email', async (req, res) => {
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

    // Find user by auth_id
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('auth_id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user email
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !authUser?.user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = authUser.user.email;

    // Use the reusable function to send claim token email
    const result = await sendClaimTokenEmail(email, userId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send magic link email'
      });
    }

    return res.json(result);
  } catch (error) {
    console.error('[send-magiclink-email] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send magic link email',
      details: error.message
    });
  }
});

/**
 * POST /api/create-account-dev
 * Development endpoint: Creates a test account with just an email (no password required)
 * Generates a confirmation token and sends email
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
    const confirmUrl = `${process.env.WEB_PORTAL_URL}/#/confirm?token=${encodeURIComponent(claimToken)}`;
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

// Developer function: Sends an email with an encrypted magic link token for testing the token claiming flow
app.post('/auth/send-magiclink-email', async (req, res) => {
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

    // Find user by auth_id
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('auth_id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user email
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !authUser?.user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = authUser.user.email;

    // Use the reusable function to send claim token email
    const result = await sendClaimTokenEmail(
      supabase,
      resend,
      email,
      userId,
      process.env.WEB_PORTAL_URL,
      FREE_TOKENS_GRANT,
      process.env.EMAIL_FROM,
      (text) => encrypt(text, keyBuffer)
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send magic link email'
      });
    }

    return res.json(result);
  } catch (error) {
    console.error('[send-magiclink-email] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send magic link email',
      details: error.message
    });
  }
});