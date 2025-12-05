// Shared constants for the ScribeFold AI Web Portal

// API base URL (production)
export const API_BASE_URL = 'https://scribefold-ai-api-server.onrender.com';

// Stripe customer portal URL (hosted by Stripe)
// Test-mode portal link for managing subscriptions
export const STRIPE_CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/login/test_bJe8wR5XrfVt3fE7mXaIM00';

// GitHub repository info for releases
export const GITHUB_REPO_OWNER = 'AbeApple';
export const GITHUB_REPO_NAME = 'scribefold-ai-monorepo';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
