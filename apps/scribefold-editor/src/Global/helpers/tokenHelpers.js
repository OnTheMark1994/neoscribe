/**
 * Helper functions for token calculations
 */

/**
 * Calculate available tokens from user data
 * Formula: tokens_added + tokens_monthly - tokens_used_this_month
 */
export function calculateAvailableTokens(userData) {
  if (!userData) return 0;

  const tokensAdded = userData.tokens_added || 0;
  const tokensMonthly = userData.tokens_monthly || 0;
  const tokensUsedThisMonth = userData.tokens_used_this_month || 0;

  return tokensAdded + tokensMonthly - tokensUsedThisMonth;
}

/**
 * Format a number for display (with commas)
 */
export function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString();
}

/**
 * Format tokens for display
 */
export function formatTokens(tokens) {
  return formatNumber(tokens);
}
