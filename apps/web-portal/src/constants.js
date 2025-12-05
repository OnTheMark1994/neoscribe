// Shared constants for the ScribeFold AI Web Portal

// API base URL - uses environment variable with fallback
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://scribefold-ai-api.onrender.com';

// GitHub repository for downloading releases (format: owner/repo)
export const GITHUB_REPO = process.env.REACT_APP_GITHUB_REPO || 'AbeApple/scribefold-ai-monorepo';

// Stripe customer portal URL (hosted by Stripe)
// Test-mode portal link for managing subscriptions
export const STRIPE_CUSTOMER_PORTAL_URL = process.env.REACT_APP_STRIPE_CUSTOMER_PORTAL_URL || 'https://billing.stripe.com/p/login/test_bJe8wR5XrfVt3fE7mXaIM00';
