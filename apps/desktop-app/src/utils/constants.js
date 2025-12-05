// Shared constants for the ScribeFold AI Electron app

// API base URL - uses environment variable with fallback
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://scribefold-ai-api.onrender.com';

// Web portal base URL - uses environment variable with fallback
export const WEB_PORTAL_BASE_URL = process.env.REACT_APP_WEB_PORTAL_BASE_URL || 'https://scribefold-ai-web-portal.onrender.com';
