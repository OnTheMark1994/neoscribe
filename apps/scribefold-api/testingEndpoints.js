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


 // Validates a login token and returns auth credentials
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
