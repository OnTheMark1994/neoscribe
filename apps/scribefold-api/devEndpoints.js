const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { FREE_TOKENS_GRANT } = require('./constants');
const { sendClaimTokenEmail, encrypt } = require('./functions');


// Sends an encrypted magic link email for testing the token claiming flow
router.post('/send-magiclink-email', async (req, res) => {
  /**
   * POST /dev/send-magiclink-email
   *
   * Uses the same sendClaimTokenEmail function as create-account endpoint
   * Input: { userId }
   * Output: { success, message, magicLinkUrl?, error? }
  */
  try {
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

    const callerUserId = decoded?.sub; // auth_id from JWT token

    if (!callerUserId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token: no user ID found'
      });
    }

    const { userId } = req.body || {};

    if (!req.supabaseAdmin) {
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
    const { data: user, error: fetchError } = await req.supabaseAdmin
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
    const { data: authUser, error: userError } = await req.supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !authUser?.user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = authUser.user.email;

    // Use the reusable function to send claim token email
    const result = await sendClaimTokenEmail(
      req.supabaseAdmin,
      req.resend,
      email,
      userId,
      process.env.WEB_PORTAL_URL,
      FREE_TOKENS_GRANT,
      process.env.EMAIL_FROM,
      (text) => encrypt(text, req.keyBuffer)
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

module.exports = router;
