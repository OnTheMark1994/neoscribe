/**
 * Helper functions for the scribefold-api server
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Calls DeepSeek's Chat Completions API
 */
async function callDeepSeekChatCompletions({ messages, model = 'deepseek-chat', temperature = 0.7 }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is missing. Add it to your environment (.env) before starting the server.');
  }

  const requestBody = {
    model,
    messages,
    stream: false,
    temperature,
  };

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
 * Create encryption key buffer from hex string
 */
function createKeyBuffer(encryptionKey) {
  return Buffer.from(encryptionKey, 'hex');
}

/**
 * Encrypt text using AES-256-CBC with fixed IV
 */
function encrypt(text, keyBuffer) {
  const IV_LENGTH = 16;
  const FIXED_IV = Buffer.alloc(IV_LENGTH, 0);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, FIXED_IV);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return encrypted.toString('hex');
}

/**
 * Decrypt text using AES-256-CBC with fixed IV
 */
function decrypt(text, keyBuffer) {
  const IV_LENGTH = 16;
  const FIXED_IV = Buffer.alloc(IV_LENGTH, 0);
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, FIXED_IV);
  return Buffer.concat([
    decipher.update(Buffer.from(text, 'hex')),
    decipher.final()
  ]).toString();
}

/**
 * Generate a random unique token
 */
function generateUniqueToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Generate a signed JWT token for email confirmation
 */
function generateConfirmationToken(userId, email, password, secret, expiry = '24h') {
  return jwt.sign(
    { userId, email, password },
    secret,
    { expiresIn: expiry }
  );
}

/**
 * Verify and decode a confirmation token
 */
function verifyConfirmationToken(token, secret) {
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (err) {
    console.error('[verifyConfirmationToken] Invalid or expired token:', err.message);
    return null;
  }
}

/**
 * Send confirmation email via Resend
 */
async function sendConfirmationEmail(resend, toEmail, confirmUrl, emailFrom) {
  if (!resend) {
    console.warn('[sendConfirmationEmail] Resend not configured, skipping email. Confirm URL:', confirmUrl);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: emailFrom,
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
 * Send claim token email using encrypted magic link approach
 */
async function sendClaimTokenEmail(supabaseAdmin, resend, email, userId = null, webPortalUrl, freeTokensGrant, emailFrom, encrypt) {
  try {
    console.log('[sendClaimTokenEmail] Sending claim token email to:', email);

    // If userId provided, find user
    let user = null;
    if (userId) {
      const { data: userData, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('id, auth_id')
        .eq('auth_id', userId)
        .single();

      if (fetchError || !userData) {
        console.error('[sendClaimTokenEmail] User not found:', userId);
        return { success: false, error: 'User not found' };
      }
      user = userData;
    }

    // Generate claim token for claiming free tokens
    const claimToken = generateUniqueToken();

    // Encrypt claim token for magic link
    const encryptedClaimToken = encrypt(claimToken);
    const encryptedAuthId = encrypt(userId);

    // Save to session_builders table
    const { error: insertError } = await supabaseAdmin
      .from('session_builders')
      .insert({
        field1: encryptedClaimToken,
        field2: encryptedAuthId
      });

    if (insertError) {
      console.error('[sendClaimTokenEmail] Failed to save to session_builders:', insertError);
      return { success: false, error: 'Failed to generate magic link' };
    }

    // Generate magic link URL for email
    const magicLinkUrl = `${webPortalUrl}/#/claim-tokens-encrypted?token=${claimToken}`;

    // Send magic link email for claiming tokens
    const emailResult = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: 'Claim Your Free Tokens for ScribeFold',
      html: `
        <h2>Claim Your Free Tokens</h2>
        <p>Click the link below to claim ${freeTokensGrant.toLocaleString()} free tokens for your ScribeFold account:</p>
        <p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>
        <p>This link will expire after use.</p>
      `
    });

    if (emailResult.error) {
      console.error('[sendClaimTokenEmail] Failed to send email:', emailResult.error);
      return { success: false, error: 'Failed to send email' };
    }

    console.log('[sendClaimTokenEmail] Email sent successfully');
    return {
      success: true,
      message: `Magic link email sent to ${email}`,
      email: email,
      magicLinkUrl: magicLinkUrl
    };
  } catch (error) {
    console.error('[sendClaimTokenEmail] Error:', error);
    return {
      success: false,
      error: 'Failed to send magic link email',
      details: error.message
    };
  }
}

/**
 * Calculate available tokens from user data
 * Formula: tokens_added + tokens_monthly
 * Note: tokens_used fields are just for display, not deducted from available tokens
 */
function calculateAvailableTokens(userData) {
  if (!userData) return 0;
  const tokensAdded = userData.tokens_added || 0;
  const tokensMonthly = userData.tokens_monthly || 0;
  return tokensAdded + tokensMonthly;
}

/**
 * Estimate tokens used for a request/response
 * Rough estimate: 1 token ≈ 4 characters
 * In production, you'd use the actual token count from the API response
 */
function estimateTokensUsed(messages, responseText) {
  const messageText = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
  return Math.ceil((messageText + responseText.length) / 4);
}

/**
 * Update user tokens after a chat request
 * Deducts from tokens_monthly first, then tokens_added
 * Note: tokens_used_this_month and tokens_used_all_time are just for display
 */
function updateUserTokens(userData, estimatedTokensUsed) {
  const tokensMonthly = userData.tokens_monthly || 0;
  const tokensAdded = userData.tokens_added || 0;
  const tokensUsedThisMonth = userData.tokens_used_this_month || 0;
  const tokensUsedAllTime = userData.tokens_used_all_time || 0;

  // Deduct from tokens_monthly first
  let remainingToDeduct = estimatedTokensUsed;
  let newTokensMonthly = tokensMonthly;
  let newTokensAdded = tokensAdded;

  // Use monthly tokens first
  if (remainingToDeduct > 0 && newTokensMonthly > 0) {
    const deductFromMonthly = Math.min(remainingToDeduct, newTokensMonthly);
    newTokensMonthly -= deductFromMonthly;
    remainingToDeduct -= deductFromMonthly;
  }

  // Then use added tokens if monthly is exhausted
  if (remainingToDeduct > 0 && newTokensAdded > 0) {
    const deductFromAdded = Math.min(remainingToDeduct, newTokensAdded);
    newTokensAdded -= deductFromAdded;
    remainingToDeduct -= deductFromAdded;
  }

  // Update usage counters (for display only)
  const newTokensUsedThisMonth = Math.max(0, tokensUsedThisMonth + estimatedTokensUsed);
  const newTokensUsedAllTime = Math.max(0, tokensUsedAllTime + estimatedTokensUsed);

  return {
    tokens_monthly: newTokensMonthly,
    tokens_added: newTokensAdded,
    tokens_used_this_month: newTokensUsedThisMonth,
    tokens_used_all_time: newTokensUsedAllTime,
    available_tokens: Math.max(0, newTokensMonthly + newTokensAdded)
  };
}

module.exports = {
  callDeepSeekChatCompletions,
  createKeyBuffer,
  encrypt,
  decrypt,
  generateUniqueToken,
  generateConfirmationToken,
  verifyConfirmationToken,
  sendConfirmationEmail,
  sendClaimTokenEmail,
  calculateAvailableTokens,
  estimateTokensUsed,
  updateUserTokens
};
