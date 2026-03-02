// Shared constants for the ScribeFold AI Web Portal

// Subscription plans - full plan data for frontend display
// IMPORTANT: If you update this PLANS array, you must also update the PLANS object
// in apps/scribefold-api/constants.js
export const PLANS = [
  {
    id: 'light',
    name: 'Light',
    description: 'Good for occasional writing and small projects.',
    tokens: 1000000,
    monthlyPrice: 8.5,
    tier_id: 1
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Good for regular use and active editing sessions.',
    tokens: 2500000,
    monthlyPrice: 14.5,
    tier_id: 2
  },
  {
    id: 'full',
    name: 'Standard',
    description: 'Great for creating stories and books.',
    tokens: 8500000,
    monthlyPrice: 28.5,
    tier_id: 3
  },
  {
    id: 'heavy',
    name: 'Heavy',
    description: 'Dare you to use them all.',
    tokens: 85000000,
    monthlyPrice: 89.5,
    tier_id: 4
  }
];