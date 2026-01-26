const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { FREE_TOKENS_GRANT } = require('./constants');
const { encrypt, decrypt } = require('./functions');

// Creates a token and saves encrypted copy, used for auto login
// was: app.post('/api/generate-encrypted-login-token', async (req, res) => {
router.post('/generate-encrypted-login-token', async (req, res) => {
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
    const { data: userData, error: fetchError } = await req.supabase
      .from('users')
      .select('id, auth_id')
      .eq('auth_id', authUserId)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user email
    const { data: user, error: userError } = await req.supabase.auth.admin.getUserById(userData.auth_id);
    if (userError || !user?.user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = user.user.email;

    // Generate a secure, one-time token
    const loginToken = crypto.randomBytes(32).toString('hex');

    // Encrypt token and auth_id
    const encryptedToken = encrypt(loginToken, req.keyBuffer);
    const encryptedAuthId = encrypt(authUserId, req.keyBuffer);

    // Save to session_builders table (field1 = encrypted token, field2 = encrypted auth_id)
    const { error: insertError } = await req.supabase
      .from('session_builders')
      .insert({
        field1: encryptedToken,
        field2: encryptedAuthId
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
// was app.post('/auth/auto-login-magiclink-enc', async (req, res) => {
router.post('/auto-login-magiclink-enc', async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    // Look up in session_builders table by encrypted token
    const encryptedToken = encrypt(token, req.keyBuffer);
    const { data: sessionRow, error: findError } = await req.supabase
      .from('session_builders')
      .select('field1, field2')
      .eq('field1', encryptedToken)
      .single();

    if (findError || !sessionRow) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Decrypt auth_id from field2
    const encryptedAuthId = sessionRow.field2;
    const authId = decrypt(encryptedAuthId, req.keyBuffer);

    // Delete the session entry after use
    await req.supabase
      .from('session_builders')
      .delete()
      .eq('field1', encryptedToken);

    // Get user email for magic link
    const { data: authUser, error: authError } = await req.supabase.auth.admin.getUserById(authId);
    if (authError || !authUser?.user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }
    const email = authUser.user.email;

    // Generate magic link
    const { data: linkData, error: linkError } = await req.supabase.auth.admin.generateLink({
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
// was app.post('/auth/claim-tokens-encrypted', async (req, res) => {
router.post('/claim-tokens-encrypted', async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!req.supabase) {
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
    const encryptedToken = encrypt(token, req.keyBuffer);

    // Look up in session_builders table
    const { data: sessionRow, error: findError } = await req.supabase
      .from('session_builders')
      .select('field1, field2')
      .eq('field1', encryptedToken)
      .single();

    if (findError || !sessionRow) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Decrypt auth_id from field2
    const encryptedAuthId = sessionRow.field2;
    const authId = decrypt(encryptedAuthId, req.keyBuffer);

    // Delete the session entry after use
    await req.supabase
      .from('session_builders')
      .delete()
      .eq('field1', encryptedToken);

    // Find user in users table by auth_id
    const { data: user, error: userError } = await req.supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Add tokens to user
    const newTokensAdded = (Number(user.tokens_added) || 0) + FREE_TOKENS_GRANT;
    const { error: updateError } = await req.supabase
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

    // Get user email for magic link
    const { data: authUser, error: authError } = await req.supabase.auth.admin.getUserById(authId);
    if (authError || !authUser?.user?.email) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate magic link'
      });
    }
    const email = authUser.user.email;

    // Generate magic link for auto-login
    const { data: linkData, error: linkError } = await req.supabase.auth.admin.generateLink({
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

module.exports = router;
