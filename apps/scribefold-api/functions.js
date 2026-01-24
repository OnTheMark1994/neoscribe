/**
 * Helper functions for the scribefold-api server
 */

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
  calculateAvailableTokens,
  estimateTokensUsed,
  updateUserTokens
};
